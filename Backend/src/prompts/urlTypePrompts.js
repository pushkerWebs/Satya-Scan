/**
 * urlTypePrompts.js
 *
 * Specialized Gemini prompt builders for non-news URL page types.
 * Used ONLY by the URL verification path in textVerificationService.js.
 *
 * Does NOT modify or import from textVerification.js.
 * The existing buildTextVerificationPrompt() is still used for 'news' pages.
 *
 * Page types handled here:
 *   official     → authoritative org/gov page
 *   reference    → educational / encyclopedia page
 *   opinion      → blog / editorial / opinion column
 *   social_media → social media post
 */

// ─── Shared helpers ───────────────────────────────────────────────────────────

function buildEvidenceBlock(evidenceArticles) {
  if (!evidenceArticles || evidenceArticles.length === 0) return '';
  return evidenceArticles
    .map((article, i) => {
      const pub = article.source || 'Unknown';
      const factCheckLabel = article.isFactCheck
        ? '\n⚑ OFFICIAL FACT-CHECK — treat this as highest-priority evidence'
        : '';
      const rating = article.rating ? `\nOFFICIAL RATING: ${article.rating}` : '';
      return `--- RELATED SOURCE #${i + 1} (Publisher: ${pub})${factCheckLabel} ---\nTitle: ${article.title || 'Untitled'}\nPublisher: ${pub}${rating}\nContent: ${article.content || article.snippet || 'No content available'}\n---`;
    })
    .join('\n\n');
}

function buildEntityContext(entities = {}) {
  return [
    entities.people?.length ? `People mentioned: ${entities.people.join(', ')}` : '',
    entities.locations?.length ? `Locations: ${entities.locations.join(', ')}` : '',
    entities.events?.length ? `Events: ${entities.events.join(', ')}` : '',
    entities.organisations?.length ? `Organisations: ${entities.organisations.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function languageInstruction(language) {
  return language === 'hi'
    ? 'You MUST respond entirely in Hindi (Devanagari script). All text fields including verdict, reasoning, summary, and claim text MUST be in Hindi.'
    : 'You MUST respond entirely in English.';
}

// ─── Official Government / Organization Page ──────────────────────────────────

/**
 * Prompt for official government or authoritative organization pages.
 * Instructs Gemini to summarize and NOT label as True/False/Misleading.
 * Always returns verdict: "INFORMATIONAL".
 */
function buildOfficialPagePrompt(pageText, evidenceArticles, language, entities = {}) {
  const evidenceBlock = buildEvidenceBlock(evidenceArticles);
  const entityContext = buildEntityContext(entities);
  const langInstruction = languageInstruction(language);

  return `You are analyzing an official government or authoritative organization webpage.

CRITICAL RULE: This is an OFFICIAL INFORMATIONAL PAGE. You MUST NOT label it as True, False, or Misleading.
Official pages publish authoritative information — they are the source, not the claim.
Your role is to SUMMARIZE what this page says and present it clearly.

PAGE CONTENT (from official source):
"${pageText}"

${entityContext ? `CONTEXT:\n${entityContext}\n` : ''}${evidenceBlock ? `RELATED COVERAGE FROM OTHER PUBLISHERS:\n${evidenceBlock}\n` : ''}

INSTRUCTIONS:
1. Write a clear 2-3 sentence summary of what this official page communicates. Be factual and neutral.
2. Identify up to 3 key factual statements or announcements from this page.
3. For each statement, note whether other sources cover or confirm it (use the related sources above if available).
4. The verdict MUST be "INFORMATIONAL" — never True, False, Misleading, or Partially True.
5. Write like a journalist summarizing a government press release — clear, factual, no judgment.
6. ${langInstruction}

You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation outside JSON.

RESPONSE FORMAT:
{
  "verdict": "INFORMATIONAL",
  "confidence": <number 75-100: how clearly this official page communicates its content>,
  "summary": "<2-3 sentence factual summary of what this official page says — no judgment>",
  "reasoning": "<Brief explanation that this is an authoritative official source. Mention whether related coverage from other publishers supports the information presented.>",
  "claims": [
    {
      "text": "<key factual statement or announcement from this official page>",
      "verdict": "Supported | Unverified",
      "confidence": <number 0-100>,
      "reasoning": "<1-2 sentences: does any related coverage confirm or provide context for this statement?>",
      "supportingSources": [<0-based indices of supporting evidence articles>],
      "contradictingSources": []
    }
  ]
}

STRICT RULES:
• verdict at the top level MUST always be "INFORMATIONAL".
• Individual claim verdicts can be "Supported" or "Unverified" only — NOT Contradicted or Misleading.
• If no related sources are available, claims default to "Unverified" with confidence 50.
• Never fabricate content. Only report what appears in the page content above.`;
}

// ─── Reference / Knowledge Page ───────────────────────────────────────────────

/**
 * Prompt for educational reference pages (Wikipedia, Britannica, etc.).
 * Instructs Gemini to summarize educational content. Never marks as Misleading.
 * Always returns verdict: "INFORMATIONAL".
 */
function buildReferencePagePrompt(pageText, evidenceArticles, language, entities = {}) {
  const evidenceBlock = buildEvidenceBlock(evidenceArticles);
  const entityContext = buildEntityContext(entities);
  const langInstruction = languageInstruction(language);

  return `You are analyzing an educational reference page — for example, a Wikipedia article, Britannica entry, or encyclopedia page.

CRITICAL RULE: This is EDUCATIONAL REFERENCE CONTENT, not a news claim.
Reference pages provide established knowledge. You MUST NOT evaluate them as True, False, or Misleading.
Your job is to summarize the educational content clearly and helpfully.

PAGE CONTENT (from reference/encyclopedia source):
"${pageText}"

${entityContext ? `CONTEXT:\n${entityContext}\n` : ''}${evidenceBlock ? `ADDITIONAL RELATED SOURCES:\n${evidenceBlock}\n` : ''}

INSTRUCTIONS:
1. Write a 2-3 sentence plain-language summary of the topic this reference page covers.
2. Identify 2-3 key educational facts or concepts explained in this page.
3. Explain in the reasoning that this is a reference/encyclopedia page providing established knowledge, not a news claim.
4. The verdict MUST be "INFORMATIONAL" — never True, False, Misleading, or Partially True.
5. Write clearly at a level a general audience can understand.
6. ${langInstruction}

You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation outside JSON.

RESPONSE FORMAT:
{
  "verdict": "INFORMATIONAL",
  "confidence": <number 75-100: how clearly this reference page explains its topic>,
  "summary": "<2-3 sentence plain-language summary of the topic and key information on this reference page>",
  "reasoning": "<Explain that this is an educational reference page providing established knowledge. Note the main topics covered. This is not a news claim and is not evaluated as true or false.>",
  "claims": [
    {
      "text": "<key educational fact or concept from this reference page>",
      "verdict": "Supported | Unverified",
      "confidence": <number 0-100>,
      "reasoning": "<1-2 sentences: is this consistent with related sources or established knowledge?>",
      "supportingSources": [<0-based indices of supporting evidence articles>],
      "contradictingSources": []
    }
  ]
}

STRICT RULES:
• verdict at the top level MUST always be "INFORMATIONAL".
• Individual claim verdicts can be "Supported" or "Unverified" only.
• Never label educational content as Misleading.
• Never fabricate content. Only report what appears in the page content above.`;
}

// ─── Blog / Opinion Content ───────────────────────────────────────────────────

/**
 * Prompt for opinion, editorial, and blog pages.
 * Instructs Gemini to separate opinions from factual claims and verify only the facts.
 * Always returns verdict: "OPINION".
 */
function buildOpinionPagePrompt(pageText, evidenceArticles, language, entities = {}) {
  const evidenceBlock = buildEvidenceBlock(evidenceArticles);
  const entityContext = buildEntityContext(entities);
  const langInstruction = languageInstruction(language);

  return `You are analyzing an opinion column, editorial, or blog post.

CONTEXT: Opinion and editorial content expresses the author's personal views and arguments.
Your job is to:
  1. Clearly identify this as opinion/editorial content.
  2. Separate the author's OPINIONS (personal views, value judgments, predictions) from FACTUAL CLAIMS (verifiable statements of fact).
  3. Verify only the factual claims using the evidence provided.
  4. Always return verdict "OPINION" at the top level.

PAGE CONTENT (opinion/blog):
"${pageText}"

${entityContext ? `ENTITIES IDENTIFIED:\n${entityContext}\n` : ''}${evidenceBlock ? `EVIDENCE FROM INDEPENDENT SOURCES:\n${evidenceBlock}\n` : ''}

INSTRUCTIONS:
1. Write a 2-3 sentence summary: state clearly this is an opinion piece, what argument it makes, and whether its factual underpinnings are supported.
2. Identify 2-4 FACTUAL CLAIMS the opinion makes (not the opinions themselves — verifiable statements of fact only).
3. Verify each factual claim against the evidence. Write like a human journalist — cite publishers by name, not "Source 1" or "Evidence #1".
4. The overall verdict MUST be "OPINION".
5. Individual claim verdicts use: Supported, Contradicted, Unverified, or Misleading.
6. ${langInstruction}

You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation outside JSON.

RESPONSE FORMAT:
{
  "verdict": "OPINION",
  "confidence": <number 0-100: overall reliability of the factual claims made in this opinion piece>,
  "summary": "<2-3 sentences: this is an opinion piece arguing [X]. Its factual claims [brief assessment].>",
  "reasoning": "<3-4 bullet-point sentences: (1) note this is opinion/editorial content, (2) identify 1-2 factual claims made, (3) assess whether those facts are supported by the evidence — cite publishers by name, not source numbers>",
  "claims": [
    {
      "text": "<a specific FACTUAL claim made within the opinion piece — NOT the opinion itself>",
      "verdict": "Supported | Contradicted | Unverified | Misleading",
      "confidence": <number 0-100>,
      "reasoning": "<2 sentences: assess this specific factual claim against the evidence. Cite publisher names.>",
      "supportingSources": [<0-based indices of supporting evidence>],
      "contradictingSources": [<0-based indices of contradicting evidence>]
    }
  ]
}

STRICT RULES:
• verdict at the top level MUST always be "OPINION".
• Do NOT include opinion statements or value judgments as claims — only verifiable facts.
• Never write "Source 1", "Source 2", "Evidence #1" — FORBIDDEN. Use publisher names.
• If no factual claims can be verified, return an empty claims array and confidence 0.
• Never fabricate evidence or content.`;
}

// ─── Social Media Post ────────────────────────────────────────────────────────

/**
 * Prompt for social media posts (Twitter/X, Facebook, Reddit, etc.).
 * Extracts and verifies individual factual claims from the post.
 * Returns standard verdicts (TRUE/FALSE/MISLEADING/PARTIALLY_TRUE/UNVERIFIED).
 */
function buildSocialMediaPrompt(pageText, evidenceArticles, language, entities = {}) {
  const evidenceBlock = buildEvidenceBlock(evidenceArticles);
  const entityContext = buildEntityContext(entities);
  const langInstruction = languageInstruction(language);

  return `You are a professional fact-checker analyzing a social media post.

Your job is to:
  1. Extract the individual factual claims made in this post.
  2. Verify each claim against the evidence provided.
  3. Return a clear, evidence-based verdict.

Write like a human journalist fact-checking a viral post — cite publishers by name, never "Source 1" or "Evidence #1".

SOCIAL MEDIA POST CONTENT:
"${pageText}"

${entityContext ? `ENTITIES IDENTIFIED:\n${entityContext}\n` : ''}${evidenceBlock ? `EVIDENCE FROM VERIFIED SOURCES:\n${evidenceBlock}\n` : 'No supporting evidence was retrieved.'}

INSTRUCTIONS:
1. Identify 2-4 individual factual claims made in this post (ignore emojis, personal reactions, or pure opinions).
2. Verify each claim independently against the evidence above.
3. Write a concise 2-sentence summary of what the post claims and what the evidence shows.
4. Write 3-5 bullet-point reasoning sentences — cite publishers by name, not source numbers.
5. ${langInstruction}

You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation outside JSON.

RESPONSE FORMAT:
{
  "verdict": "TRUE | FALSE | MISLEADING | PARTIALLY_TRUE | UNVERIFIED",
  "confidence": <number 0-100>,
  "summary": "<2 sentences: what this social media post claims and what the evidence shows>",
  "reasoning": "<3-5 bullet-point sentences: evidence-based assessment of the post's claims — cite publishers by name, NEVER source numbers>",
  "claims": [
    {
      "text": "<individual factual claim from the post>",
      "verdict": "Supported | Contradicted | Unverified | Misleading",
      "confidence": <number 0-100>,
      "reasoning": "<2-3 sentences: evidence assessment for this specific claim. Cite publishers by name.>",
      "supportingSources": [<0-based indices of supporting evidence>],
      "contradictingSources": [<0-based indices of contradicting evidence>]
    }
  ]
}

STRICT RULES:
• No evidence → verdict MUST be "UNVERIFIED" with confidence 0.
• The words "Source 1", "Source 2", "Evidence 1", "Article 1" MUST NEVER appear.
• If the post contains no verifiable factual claims (e.g. pure opinion), return UNVERIFIED with an explanation.
• Never fabricate facts or evidence.
• Be appropriately sceptical — extraordinary claims require extraordinary evidence.`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Route to the correct specialized prompt based on page type.
 * Called by textVerificationService when inputType === 'url' and pageType !== 'news'.
 *
 * @param {string}   pageText        — Extracted page text (max ~5000 chars)
 * @param {object[]} evidenceArticles — Tavily + fact-check results
 * @param {string}   language        — 'en' | 'hi'
 * @param {object}   entities        — Pre-extracted entities
 * @param {string}   pageType        — 'official' | 'reference' | 'opinion' | 'social_media'
 * @returns {string} Gemini prompt string
 */
function buildUrlTypePrompt(pageText, evidenceArticles, language, entities, pageType) {
  switch (pageType) {
    case 'official':
      return buildOfficialPagePrompt(pageText, evidenceArticles, language, entities);
    case 'reference':
      return buildReferencePagePrompt(pageText, evidenceArticles, language, entities);
    case 'opinion':
      return buildOpinionPagePrompt(pageText, evidenceArticles, language, entities);
    case 'social_media':
      return buildSocialMediaPrompt(pageText, evidenceArticles, language, entities);
    default:
      throw new Error(`Unknown pageType for URL prompt: ${pageType}`);
  }
}

module.exports = { buildUrlTypePrompt };
