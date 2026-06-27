/**
 * textVerificationService.js
 * Main orchestration pipeline for claim / URL verification.
 *
 * Reasoning engine: Gemini ONLY.
 * On Gemini quota / rate-limit errors → graceful evidence-only fallback (no crash).
 * OpenAI is NOT used.
 *
 * Pipeline:
 *  1. URL scraping (if inputType === 'url') + URL type classification
 *  2. Entity extraction + language detection
 *  3. Diversified query generation (entity-aware + Gemini-enhanced)
 *  4. Google Fact Check API + Tavily (parallel)
 *  5. Merge, deduplicate, rank evidence
 *  6. Gemini reasoning — quota/error → graceful evidence-only result
 *     • URL type 'news' + all text inputs → buildTextVerificationPrompt (unchanged)
 *     • URL types official / reference / opinion / social_media → buildUrlTypePrompt
 *  7. Build structured result
 */

const logger = require('../config/logger');
const { searchMultiple } = require('./tavilyService');
const { searchFactCheck } = require('./factCheckService');
const geminiService = require('./geminiService');
const { analyzeClaimForSearch } = require('./entityExtractor');
const { extractTextFromUrl } = require('./urlScrapeService');
const {
  buildTextVerificationPrompt,
  buildQueryGenerationPrompt,
} = require('../prompts/textVerification');
const { buildUrlTypePrompt } = require('../prompts/urlTypePrompts');
const { classifyUrl } = require('./urlClassifierService');
const {
  resolveLanguage,
  getProcessingTime,
  deduplicateByKey,
  getSourceTier,
  calculateSourceCredibility,
} = require('../utils/helpers');

// ─── Gemini error classification ──────────────────────────────────────────────

function classifyGeminiError(error) {
  const msg = (error?.message || String(error)).toLowerCase();
  const cause = (error?.cause?.message || '').toLowerCase();
  const combined = msg + ' ' + cause;

  if (combined.includes('429') || combined.includes('quota') || combined.includes('resource_exhausted')) {
    return { type: 'quota', userMessage: 'Gemini API quota reached. Results are based on retrieved evidence only.' };
  }
  if (combined.includes('api_key_service_blocked') || combined.includes('403') || combined.includes('permission')) {
    return { type: 'blocked', userMessage: 'Gemini API key issue. Results are based on retrieved evidence only.' };
  }
  if (combined.includes('503') || combined.includes('502') || combined.includes('timeout') || combined.includes('econnreset')) {
    return { type: 'unavailable', userMessage: 'Gemini is temporarily unavailable. Results are based on retrieved evidence only.' };
  }
  return { type: 'unknown', userMessage: 'Gemini analysis failed. Results are based on retrieved evidence only.' };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

async function verifyText(content, inputType, selectedLanguage) {
  const startTime = Date.now();
  const responseLanguage = resolveLanguage(selectedLanguage);

  logger.info(`Starting ${inputType} verification pipeline`, {
    contentLength: content.length,
    selectedLanguage,
    responseLanguage,
  });

  // ── Step 1: Content extraction + URL classification ──────────────────────
  let claimText = content;
  let pageClassification = null; // Only set for URL inputs

  if (inputType === 'url') {
    logger.info('Step 1: Scraping URL for content');
    claimText = await extractTextFromUrl(content);

    // Classify the URL type (pure heuristic — no network call)
    pageClassification = classifyUrl(content);
    logger.info(`Step 1a: URL classified as "${pageClassification.pageType}" — ${pageClassification.pageTypeLabel}`);
  } else {
    logger.info('Step 1: Using provided text content');
  }

  // ── Step 2: Entity extraction + language detection ────────────────────────
  logger.info('Step 2: Extracting entities and detecting language');
  const { entities, queries: entityQueries, detectedLanguage } = analyzeClaimForSearch(claimText);
  logger.info(`Detected language: ${detectedLanguage}, entities: people=${entities.people.join(',')}, locations=${entities.locations.join(',')}, events=${entities.events.join(',')}`);

  // ── Step 3: Diversified query generation (Gemini-enhanced) ───────────────
  logger.info('Step 3: Generating diversified search queries');
  let aiQueries = [];

  try {
    const queryPrompt = buildQueryGenerationPrompt(claimText.slice(0, 2000), entities);
    aiQueries = await geminiService.generateSearchQueries(queryPrompt);
    logger.info(`Gemini generated ${aiQueries.length} queries`);
  } catch (queryErr) {
    const cls = classifyGeminiError(queryErr);
    logger.warn(`Gemini query generation failed (${cls.type}) — using entity-derived queries only`);
    // Non-fatal: entity queries are sufficient
  }

  // Merge entity-derived + AI queries, deduplicate, cap at 8
  const mergedQueries = [...new Set([...entityQueries, ...aiQueries])]
    .filter((q) => q && q.trim().length > 8)
    .slice(0, 8);

  if (!mergedQueries.some((q) => q.startsWith(claimText.slice(0, 50)))) {
    mergedQueries.unshift(claimText.slice(0, 300));
  }

  const searchQueries = mergedQueries.slice(0, 8);
  logger.info(`Final search queries (${searchQueries.length}): ${JSON.stringify(searchQueries)}`);

  // ── Step 4+5: Parallel evidence retrieval ─────────────────────────────────
  logger.info('Step 4+5: Fetching Google Fact Check API and Tavily in parallel');
  const [factCheckResults, tavilyResults] = await Promise.all([
    searchFactCheck(claimText.slice(0, 500)),
    searchMultiple(searchQueries),
  ]);

  logger.info(`Fact Check API: ${factCheckResults.length} | Tavily: ${tavilyResults.length}`);

  // ── Step 6: Merge, deduplicate, rank ──────────────────────────────────────
  logger.info('Step 6: Merging and ranking evidence');
  const combined = [...factCheckResults, ...tavilyResults];
  const uniqueEvidence = deduplicateByKey(combined, 'url');

  uniqueEvidence.sort((a, b) => {
    if (a.isFactCheck && !b.isFactCheck) return -1;
    if (!a.isFactCheck && b.isFactCheck) return 1;
    const tierA = a.tier || getSourceTier(a.url);
    const tierB = b.tier || getSourceTier(b.url);
    if (tierA !== tierB) return tierA - tierB;
    return (b.score || 0) - (a.score || 0);
  });

  logger.info(`Total unique evidence: ${uniqueEvidence.length} sources`);
  const evidenceForPrompt = uniqueEvidence.slice(0, 12);

  // ── Step 7: Gemini reasoning ───────────────────────────────────────────────
  logger.info('Step 7: Running Gemini reasoning engine');

  // For non-news URL types, use a specialized prompt; everything else uses the
  // existing text verification prompt (text inputs always use the existing prompt).
  const isSpecialUrlType = pageClassification && pageClassification.pageType !== 'news';
  const verificationPrompt = isSpecialUrlType
    ? buildUrlTypePrompt(
        claimText.slice(0, 5000),
        evidenceForPrompt,
        responseLanguage,
        entities,
        pageClassification.pageType
      )
    : buildTextVerificationPrompt(
        claimText.slice(0, 5000),
        evidenceForPrompt,
        responseLanguage,
        entities
      );

  let geminiResult = null;
  let usedFallback = false;
  let providerWarning = null;

  try {
    logger.debug('Gemini prompt length:', verificationPrompt.length);
    geminiResult = await geminiService.analyzeText(verificationPrompt);
    logger.info('Gemini analysis complete', { verdict: geminiResult.verdict });
  } catch (geminiError) {
    usedFallback = true;
    const cls = classifyGeminiError(geminiError);
    providerWarning = cls.userMessage;

    logger.warn(`Gemini failed (${cls.type}): ${geminiError.message} — using evidence-only fallback`);

    geminiResult = buildEvidenceOnlyResult(
      claimText,
      evidenceForPrompt,
      responseLanguage,
      providerWarning
    );
  }

  // ── Step 8: Build structured result ──────────────────────────────────────
  logger.info('Step 8: Building structured result');
  const claims = buildClaims(geminiResult, evidenceForPrompt);
  let trustScore = calculateTrustScore(geminiResult, claims, factCheckResults.length > 0);
  const sourceCredibility = calculateSourceCredibility(uniqueEvidence);
  const aiLikelihood = geminiResult.aiLikelihood || estimateAiLikelihood(claimText);

  // ── URL page-type overrides (URL inputs only) ──────────────────────────────
  // official / reference pages are authoritative sources — floor their trust score
  // at 75 so the reliability ring looks sensible.
  // The frontend display verdict is driven by pageVerdict, not trustScore, for these types.
  if (pageClassification && ['official', 'reference'].includes(pageClassification.pageType)) {
    trustScore = Math.max(trustScore, 75);
  }

  // Determine the display-level verdict override sent to the frontend.
  //   'official' / 'reference'  → 'Informational'  (teal, no True/False/Misleading)
  //   'opinion'                 → 'Opinion'         (purple, factual claims still shown)
  //   'social_media' / 'news'   → undefined         (standard trustScore-derived verdict)
  let pageVerdict;
  if (pageClassification) {
    if (['official', 'reference'].includes(pageClassification.pageType)) {
      pageVerdict = 'Informational';
    } else if (pageClassification.pageType === 'opinion') {
      pageVerdict = 'Opinion';
    }
  }

  const result = {
    inputType,
    trustScore,
    aiLikelihood,
    aiScore: 100 - aiLikelihood,
    aiReasoning: geminiResult.reasoning || geminiResult.summary || '',
    sourceCredibility,
    language: responseLanguage,
    detectedLanguage: detectedLanguage !== 'en' ? detectedLanguage : responseLanguage,
    responseLanguage,
    claims,
    entities,
    factCheckHits: factCheckResults.length,
    apiWorking: !usedFallback,
    reasoningProvider: usedFallback ? 'evidence-only' : 'gemini',
    providerStatus: usedFallback ? 'degraded' : 'ok',
    providerWarning,
    processingTime: getProcessingTime(startTime),
    _verdict: geminiResult.verdict,
    _confidence: geminiResult.confidence,
    _summary: geminiResult.summary,
    _originalText: claimText.slice(0, 10000),
    _queriesUsed: searchQueries,
    // ── URL classification metadata — only present for URL inputs ────────────
    ...(pageClassification ? {
      pageType: pageClassification.pageType,
      pageTypeLabel: pageClassification.pageTypeLabel,
      pageTypeDescription: pageClassification.pageTypeDescription,
    } : {}),
    // pageVerdict overrides the trust-score-derived display verdict on the frontend
    ...(pageVerdict ? { pageVerdict } : {}),
  };

  logger.info('Verification pipeline complete', {
    trustScore,
    claimsCount: claims.length,
    factCheckHits: factCheckResults.length,
    usedFallback,
    processingTime: result.processingTime,
  });

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEvidenceOnlyResult(claimText, evidenceSources, responseLanguage, providerWarning) {
  const trustedCount = evidenceSources.filter((s) => s.trusted).length;
  const factCheckCount = evidenceSources.filter((s) => s.isFactCheck).length;
  const hasEvidence = evidenceSources.length > 0;
  const confidence = hasEvidence
    ? Math.min(60, 20 + trustedCount * 8 + factCheckCount * 12 + evidenceSources.length * 2)
    : 0;

  const summary =
    responseLanguage === 'hi'
      ? 'AI विश्लेषण उपलब्ध नहीं था। यह परिणाम केवल पुनर्प्राप्त स्रोतों के आधार पर बनाया गया है।'
      : `${providerWarning || 'AI analysis unavailable.'} Showing evidence-only result.`;

  const reasoning = hasEvidence
    ? `${summary} Found ${evidenceSources.length} sources (${trustedCount} from trusted publishers${factCheckCount > 0 ? `, ${factCheckCount} official fact-check(s)` : ''}). Manual review recommended.`
    : `${summary} No evidence sources were retrieved.`;

  return {
    verdict: hasEvidence && trustedCount > 0 ? 'PARTIALLY_TRUE' : 'UNVERIFIED',
    confidence,
    summary,
    reasoning,
    aiLikelihood: estimateAiLikelihood(claimText),
    claims: [
      {
        text: claimText.slice(0, 500),
        verdict: hasEvidence && trustedCount > 0 ? 'Misleading' : 'Unverified',
        confidence,
        reasoning,
        supportingSources: evidenceSources.map((_, i) => i).slice(0, 5),
        contradictingSources: [],
      },
    ],
  };
}

function buildClaims(geminiResult, evidenceSources) {
  const rawClaims = geminiResult.claims || [];

  if (rawClaims.length === 0) {
    return [
      {
        text: geminiResult.summary || 'Overall claim',
        verdict: mapVerdict(geminiResult.verdict),
        confidence: geminiResult.confidence || 0,
        reasoning: geminiResult.reasoning || '',
        sourceCount: evidenceSources.length,
        trustedSourceCount: evidenceSources.filter((s) => s.trusted).length,
        sources: evidenceSources.slice(0, 5).map(toSourceShape),
      },
    ];
  }

  return rawClaims.map((claim) => {
    const supportingIndices = claim.supportingSources || [];
    const contradictingIndices = claim.contradictingSources || [];
    const allIndices = [...new Set([...supportingIndices, ...contradictingIndices])];

    const claimSources = allIndices
      .filter((i) => i >= 0 && i < evidenceSources.length)
      .map((i) => toSourceShape(evidenceSources[i]));

    const finalSources =
      claimSources.length > 0
        ? claimSources
        : evidenceSources.slice(0, 3).map(toSourceShape);

    return {
      text: claim.text,
      verdict: mapVerdict(claim.verdict),
      confidence: claim.confidence || 0,
      reasoning: claim.reasoning || '',
      sourceCount: finalSources.length,
      trustedSourceCount: finalSources.filter((s) => s.trusted).length,
      sources: finalSources,
    };
  });
}

function toSourceShape(s) {
  return {
    url: s.url,
    title: s.title,
    source: s.source,
    trusted: s.trusted,
    tier: s.tier,
    isFactCheck: s.isFactCheck || false,
    rating: s.rating || null,
  };
}

function mapVerdict(verdict) {
  if (!verdict) return 'Unverified';
  const normalized = verdict.toUpperCase().replace(/[_\s]+/g, '');
  const map = {
    TRUE: 'Supported',
    SUPPORTED: 'Supported',
    FALSE: 'Contradicted',
    CONTRADICTED: 'Contradicted',
    MISLEADING: 'Misleading',
    PARTIALLYTRUE: 'Misleading',
    PARTIALLY_TRUE: 'Misleading',
    UNVERIFIED: 'Unverified',
    // URL page-type verdicts
    INFORMATIONAL: 'Informational',
    OPINION: 'Opinion',
  };
  return map[normalized] || 'Unverified';
}

function calculateTrustScore(geminiResult, claims, hasFactChecks = false) {
  const verdictScores = { Supported: 85, Contradicted: 15, Misleading: 35, Unverified: 50 };

  if (claims.length === 0) return 50;

  let totalScore = 0;
  let totalWeight = 0;

  for (const claim of claims) {
    const baseScore = verdictScores[claim.verdict] || 50;
    const confidenceWeight = (claim.confidence || 50) / 100;
    const trustedBonus = claim.trustedSourceCount > 0 ? 5 : 0;
    totalScore += (baseScore + trustedBonus) * confidenceWeight;
    totalWeight += confidenceWeight;
  }

  const avgScore = totalWeight > 0 ? totalScore / totalWeight : 50;
  const geminiConfidence = geminiResult.confidence || 50;
  const factCheckBonus = hasFactChecks ? 5 : 0;
  const blendedScore = Math.round(avgScore * 0.65 + geminiConfidence * 0.35 + factCheckBonus);

  return Math.max(0, Math.min(100, blendedScore));
}

function estimateAiLikelihood(text) {
  const normalized = text.toLowerCase();
  const signals = ['as an ai', 'large language model', 'it is important to note', 'delve', 'furthermore', 'in conclusion', 'i cannot', 'i am unable to'];
  const hits = signals.filter((s) => normalized.includes(s)).length;
  return Math.min(75, 15 + hits * 12);
}

module.exports = { verifyText };
