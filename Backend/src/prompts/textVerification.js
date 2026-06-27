/**
 * Prompt templates for text/URL fact verification.
 *
 * The reasoning engine (Gemini or OpenAI) must ONLY reason over retrieved
 * evidence — never hallucinate or use training knowledge.
 */

/**
 * Build the main fact-check verification prompt.
 * @param {string} claim         — The claim text (max ~5000 chars)
 * @param {object[]} evidenceArticles — Enriched source objects
 * @param {string} language      — 'en' | 'hi'
 * @param {object} entities      — Extracted entities { people, locations, events, ... }
 */
function buildTextVerificationPrompt(claim, evidenceArticles, language, entities = {}) {
  const languageInstruction =
    language === 'hi'
      ? 'You MUST respond entirely in Hindi (Devanagari script). All text fields including verdict, reasoning, and summary MUST be in Hindi.'
      : 'You MUST respond entirely in English.';

  // Build evidence block — label fact-checks prominently
  const evidenceBlock = evidenceArticles
    .map((article, i) => {
      const pub = article.source || 'Unknown';
      const factCheckLabel = article.isFactCheck
        ? `\n⚑ OFFICIAL FACT-CHECK — treat this as the highest-priority evidence`
        : '';
      const rating = article.rating ? `\nOFFICIAL RATING: ${article.rating}` : '';
      return `--- EVIDENCE #${i + 1} (Publisher: ${pub})${factCheckLabel} ---
Title: ${article.title || 'Untitled'}
Publisher: ${pub}${rating}
Content: ${article.content || article.snippet || 'No content available'}
---`;
    })
    .join('\n\n');

  // Entity context section (helps AI understand what to look for)
  const entityContext =
    [
      entities.people?.length ? `People mentioned: ${entities.people.join(', ')}` : '',
      entities.locations?.length ? `Locations: ${entities.locations.join(', ')}` : '',
      entities.events?.length ? `Events: ${entities.events.join(', ')}` : '',
      entities.organisations?.length ? `Organisations: ${entities.organisations.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

  return `You are a senior professional fact-checker at an independent investigative newsroom.
Your job is to verify the following claim using ONLY the evidence articles provided below.
NEVER use your own knowledge, memory, or training data. NEVER invent or infer facts not present in the evidence.

CLAIM TO VERIFY:
"${claim}"

${entityContext ? `ENTITIES IDENTIFIED IN CLAIM:\n${entityContext}\n` : ''}
EVIDENCE ARTICLES:
${evidenceBlock || 'No evidence articles were retrieved.'}

═══════════════════════════════
WRITING STYLE — STRICTLY FOLLOW
═══════════════════════════════
• Write like a human journalist or editor — NOT like a computer program.
• NEVER write "Source 1", "Source 2", "Article 1", "Evidence #1" — FORBIDDEN.
• Refer to sources by publisher name (e.g. "Reuters", "The Hindu", "BBC News") or describe them naturally ("multiple trusted publications", "official government sources").
• If multiple sources say the same thing, summarise ONCE — do not repeat per source.
• Keep reasoning SHORT and CLEAR — 3 to 5 bullet-point sentences maximum.
• Write at a level a 15-year-old can understand.
• NEVER repeat the same fact twice.
• GOOD: "Multiple trusted news organisations independently reported this event. Official statements support the claim."
• BAD: "Source 1 confirms... Source 2 states..." ← FORBIDDEN.

═══════════════════════════════
ANALYSIS INSTRUCTIONS
═══════════════════════════════
1. Analyse ONLY the evidence provided. Do NOT use your training data.

2. CRITICAL — Evaluate the claim EXACTLY as written. Do not rewrite, simplify or reinterpret it.
   • Return TRUE only if EVERY important part of the claim is directly supported.
   • If technically correct but missing important context, return PARTIALLY_TRUE or MISLEADING.
   • If evidence explicitly contradicts, return FALSE.
   • If evidence supports only part, explain: what is correct, what is wrong, what context is missing.

3. OFFICIAL FACT-CHECKS: If any evidence is marked "⚑ OFFICIAL FACT-CHECK", give it the highest weight.
   An official fact-check that contradicts the claim MUST result in FALSE or MISLEADING.
   An official fact-check that supports the claim increases confidence significantly.

4. Confidence must reflect evidence quality and agreement — NOT the writing style of the claim.
   • Multiple tier-1 sources agreeing → confidence 80–95.
   • Mixed signals → confidence 40–65.
   • No useful evidence → confidence 0–30, verdict UNVERIFIED.

5. Break the claim into individual factual sub-claims where appropriate.

6. ${languageInstruction}

You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation outside JSON.

RESPONSE FORMAT:
{
  "verdict": "TRUE | FALSE | MISLEADING | PARTIALLY_TRUE | UNVERIFIED",
  "confidence": <number 0-100>,
  "summary": "<one or two plain-language sentences summarising what was found — no source numbers>",
  "reasoning": "<3 to 5 short bullet-point sentences explaining the verdict, written like a human editor — NEVER use numbered source references>",
  "claims": [
    {
      "text": "<the sub-claim text>",
      "verdict": "Supported | Contradicted | Unverified | Misleading",
      "confidence": <number 0-100>,
      "reasoning": "<2 to 3 short plain-language sentences, no numbered source references>",
      "supportingSources": [<indices of supporting evidence, 0-based>],
      "contradictingSources": [<indices of contradicting evidence, 0-based>]
    }
  ]
}

STRICT RULES:
• No evidence → verdict MUST be "UNVERIFIED" with confidence 0.
• Never assign high confidence without strong supporting evidence.
• Be appropriately sceptical — extraordinary claims require extraordinary evidence.
• Distinguish "no evidence found" (UNVERIFIED) vs "evidence contradicts" (FALSE).
• The words "Source 1", "Source 2", "Article 1", "Reference 1", "Evidence 1" must NEVER appear.`;
}

/**
 * Build a search-query generation prompt.
 * Instructs the AI to generate 5–8 diverse, entity-aware queries.
 * @param {string} claim
 * @param {object} entities — pre-extracted entities (optional)
 */
function buildQueryGenerationPrompt(claim, entities = {}) {
  const entityHint =
    entities.people?.length
      ? `\nKey people mentioned: ${entities.people.join(', ')}`
      : '';
  const locationHint =
    entities.locations?.length
      ? `\nLocations: ${entities.locations.join(', ')}`
      : '';
  const eventHint =
    entities.events?.length
      ? `\nEvents/actions: ${entities.events.join(', ')}`
      : '';

  return `You are a search-query generator for an evidence verification engine.
Generate 5–8 diverse search queries to verify or debunk the following claim.
${entityHint}${locationHint}${eventHint}

CLAIM: "${claim}"

QUERY GENERATION RULES:
1. Core factual assertion — exactly what happened
2. Counter-evidence / debunking search
3. Official / authoritative source search (use "official statement", "government", etc.)
4. If a person's name appears — generate: [person name] + location, [person name] + event, [person name] fact check
5. Fact-check search: append "fact check" or "fact-check"
6. Use different phrasings, keywords and angles for maximum coverage
7. Include at least one query targeting Indian fact-check sites if the claim is India-related

Respond with ONLY a JSON array of strings. No markdown, no explanation.
Example: ["query 1", "query 2", "query 3", "query 4", "query 5"]`;
}

module.exports = { buildTextVerificationPrompt, buildQueryGenerationPrompt };
