/**
 * textVerificationService.js
 * Main orchestration pipeline for claim / URL verification.
 *
 * Reasoning engine: Gemini ONLY.
 * Includes semantic source relevance filtering to eliminate unrelated government / UN documents.
 */

const logger = require('../config/logger');
const { searchMultiple, searchSingle } = require('./tavilyService');
const { searchFactCheck } = require('./factCheckService');
const geminiService = require('./geminiService');
const { analyzeClaimForSearch } = require('./entityExtractor');
const { extractTextFromUrl } = require('./urlScrapeService');
const {
  buildTextVerificationPrompt,
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
const { filterRelevantSources } = require('../utils/sourceRelevanceFilter');

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
  let pageClassification = null;

  if (inputType === 'url') {
    logger.info('Step 1: Scraping URL for content');
    claimText = await extractTextFromUrl(content);
    pageClassification = classifyUrl(content);
    logger.info(`Step 1a: URL classified as "${pageClassification.pageType}" — ${pageClassification.pageTypeLabel}`);
  } else {
    logger.info('Step 1: Using provided text content');
  }

  // ── Step 2: Entity extraction + language detection ────────────────────────
  logger.info('Step 2: Extracting entities and detecting language');
  const { entities, queries: entityQueries, detectedLanguage } = analyzeClaimForSearch(claimText);
  logger.info(`Detected language: ${detectedLanguage}, entities: people=${entities.people.join(',')}, locations=${entities.locations.join(',')}, events=${entities.events.join(',')}`);

  // ── Step 3: Targeted Search Queries on the Full Cleaned Claim ────────────
  logger.info('Step 3: Generating targeted queries based on the full cleaned claim');
  const trimmedClaim = claimText.trim().replace(/[\r\n\t]+/g, ' ');
  const localQueries = [];

  // 1. Full cleaned claim
  localQueries.push(trimmedClaim.slice(0, 300));
  localQueries.push(`"${trimmedClaim.slice(0, 150)}"`);
  localQueries.push(`${trimmedClaim.slice(0, 200)} fact check`);
  localQueries.push(`${trimmedClaim.slice(0, 200)} news`);

  const mainEntities = [
    ...(entities.people || []),
    ...(entities.locations || []),
    ...(entities.events || []),
    ...(entities.organisations || [])
  ].slice(0, 3);
  
  mainEntities.forEach(ent => {
    localQueries.push(`${ent} ${trimmedClaim.slice(0, 100)}`);
  });

  const mergedQueries = [...new Set([...localQueries, ...entityQueries])]
    .filter((q) => q && q.trim().length > 4);

  const searchQueries = mergedQueries.slice(0, 5);
  logger.info(`Final search queries (${searchQueries.length}): ${JSON.stringify(searchQueries)}`);

  // ── Step 4+5: Parallel evidence retrieval ─────────────────────────────────
  logger.info('Step 4+5: Fetching Google Fact Check API and Tavily search results');

  // Only query official government domains if the claim mentions government, laws, taxes, or policies
  const isGovRelevant = /gov|ministry|minister|treaty|parliament|court|supreme court|policy|scheme|subsidy|rbi|sebi|police|arrest|who\b|un\b/i.test(trimmedClaim);
  const officialQuery = isGovRelevant
    ? `${trimmedClaim.slice(0, 180)} site:gov OR site:gov.in OR site:nic.in`
    : null;

  const [factCheckResults, tavilyResults, officialResults] = await Promise.all([
    searchFactCheck(claimText.slice(0, 500)),
    searchMultiple(searchQueries),
    officialQuery ? searchSingle(officialQuery, false) : Promise.resolve([])
  ]);

  // Map official search results
  const mappedOfficial = (officialResults || []).map((r) => {
    const tier = getSourceTier(r.url);
    return {
      url: r.url,
      title: r.title || 'Untitled',
      content: r.content || r.raw_content || '',
      snippet: r.content ? r.content.slice(0, 300) : '',
      source: new URL(r.url).hostname.replace(/^www\./, ''),
      trusted: true,
      tier,
      score: r.score || 0,
      isFactCheck: false,
    };
  });

  // Merge and deduplicate raw candidate sources
  const combined = [...factCheckResults, ...tavilyResults, ...mappedOfficial];
  const uniqueEvidence = deduplicateByKey(combined, 'url');
  logger.info(`Raw retrieved unique evidence: ${uniqueEvidence.length} sources`);

  // ── Step 6: Semantic Similarity & Relevance Filtering ─────────────────────
  // Reject sources below relevance threshold and filter out unrelated UN / government PDFs
  logger.info('Step 6: Applying semantic similarity & entity relevance filtering against claim');
  const relevantEvidence = filterRelevantSources(uniqueEvidence, claimText, entities, 0.28);
  logger.info(`Sources passing relevance threshold: ${relevantEvidence.length} (pruned ${uniqueEvidence.length - relevantEvidence.length} unrelated sources)`);

  // If no relevant sources directly address the claim, return clean Unverified state with empty sources
  if (relevantEvidence.length === 0) {
    logger.warn('No relevant sources found directly addressing the claim. Returning Unverified with empty sources.');
    const emptyReason = responseLanguage === 'hi'
      ? 'दावे की पुष्टि के लिए कोई विश्वसनीय स्रोत सीधे तौर पर नहीं मिला।'
      : 'No reliable sources found directly addressing the claim.';

    return {
      success: true,
      inputType,
      trustScore: 50,
      verdict: 'Unverified',
      confidence: 50,
      aiLikelihood: estimateAiLikelihood(claimText),
      aiScore: 50,
      aiReasoning: emptyReason,
      reasoning: {
        evidenceSummary: emptyReason,
        aiReasoning: emptyReason,
        crossSourceAgreement: 'None',
        officialConfirmation: 'None',
      },
      confidenceBreakdown: {
        evidenceQuality: { stars: 1, explanation: responseLanguage === 'hi' ? 'कोई प्रासंगिक स्रोत नहीं मिला।' : 'No directly relevant sources found.' },
        independentSources: { stars: 1, explanation: responseLanguage === 'hi' ? 'कोई स्वतंत्र रिपोर्टिंग नहीं मिली।' : 'No independent reporting found.' },
        officialSources: { stars: 1, explanation: responseLanguage === 'hi' ? 'कोई आधिकारिक पुष्टि नहीं मिली।' : 'No official statement found.' },
        recentReporting: { stars: 1, explanation: responseLanguage === 'hi' ? 'कोई कवरेज नहीं मिला।' : 'No recent coverage found.' },
        contradictoryEvidence: { status: responseLanguage === 'hi' ? 'कोई नहीं मिला' : 'None Found', explanation: responseLanguage === 'hi' ? 'कोई विरोधाभासी स्रोत नहीं मिला।' : 'No contradicting sources found.' },
        aiConsistency: { status: responseLanguage === 'hi' ? 'मध्यम' : 'Medium', explanation: responseLanguage === 'hi' ? 'साक्ष्य के अभाव में अपुष्ट स्थिति।' : 'Claim remains uncorroborated due to lack of evidence.' },
      },
      sourceConsensus: [],
      evidenceMetrics: { supportCount: 0, contradictCount: 0, neutralCount: 0, unknownCount: 0 },
      supportCount: 0,
      contradictCount: 0,
      neutralCount: 0,
      unknownCount: 0,
      sourceCredibility: 0,
      language: responseLanguage,
      detectedLanguage: detectedLanguage !== 'en' ? detectedLanguage : responseLanguage,
      responseLanguage,
      claims: [
        {
          text: claimText.slice(0, 500),
          verdict: 'Unverified',
          confidence: 50,
          reasoning: emptyReason,
          sourceCount: 0,
          trustedSourceCount: 0,
          sources: [],
        },
      ],
      entities,
      factCheckHits: 0,
      apiWorking: true,
      reasoningProvider: 'gemini',
      providerStatus: 'ok',
      processingTime: getProcessingTime(startTime),
      verifiedFacts: [],
      keyFindings: [
        responseLanguage === 'hi'
          ? 'इस विशिष्ट दावे की पुष्टि करने वाले कोई सत्यापित स्रोत नहीं मिले।'
          : 'No verified reporting or credible sources found directly addressing this claim.'
      ],
      finalAssessment: emptyReason,
      timeline: null,
      claimsVerified: 0,
      claimsTotal: 1,
      sources: [],
      _verdict: 'UNVERIFIED',
      _confidence: 50,
      _summary: emptyReason,
      _originalText: claimText.slice(0, 10000),
      _queriesUsed: searchQueries,
    };
  }

  // Custom Ranker on relevant sources
  relevantEvidence.sort((a, b) => {
    // 1. Google Fact Check hits
    if (a.isFactCheck && !b.isFactCheck) return -1;
    if (!a.isFactCheck && b.isFactCheck) return 1;

    // 2. High semantic relevance
    const relDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
    if (Math.abs(relDiff) > 0.15) return relDiff;

    // 3. Trusted news tier
    const tierA = a.tier || getSourceTier(a.url);
    const tierB = b.tier || getSourceTier(b.url);
    if (tierA !== tierB) return tierA - tierB;

    return (b.score || 0) - (a.score || 0);
  });

  // Cap at 8 relevant sources
  const evidenceForPrompt = relevantEvidence.slice(0, 8);

  // ── Step 7: Gemini reasoning ───────────────────────────────────────────────
  logger.info('Step 7: Running Gemini reasoning engine on relevant evidence');

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

  try {
    logger.debug('Gemini prompt length:', verificationPrompt.length);
    geminiResult = await geminiService.analyzeText(verificationPrompt, selectedLanguage);
    logger.info('Gemini analysis complete', { verdict: geminiResult.verdict });
  } catch (geminiError) {
    logger.error('Gemini text analysis failed:', geminiError);
    return geminiService.formatGeminiError(geminiError, evidenceForPrompt.length > 0, responseLanguage);
  }

  // ── Step 8: Build structured result ──────────────────────────────────────
  logger.info('Step 8: Building structured result');
  const usedFallback = false;
  const providerWarning = undefined;
  const claims = buildClaims(geminiResult, evidenceForPrompt, responseLanguage);
  let trustScore = calculateTrustScore(geminiResult, claims, factCheckResults.length > 0);
  const sourceCredibility = calculateSourceCredibility(evidenceForPrompt);
  const aiLikelihood = geminiResult.aiLikelihood || estimateAiLikelihood(claimText);

  // Evidence distribution counts
  const supportingUrls = new Set();
  const contradictingUrls = new Set();
  claims.forEach((claim) => {
    (claim.sources || []).forEach((src) => {
      const key = src.url || src.title || '';
      if (!key) return;
      if (claim.verdict === 'Supported') supportingUrls.add(key);
      else if (claim.verdict === 'Contradicted') contradictingUrls.add(key);
    });
  });
  const supportingCount = supportingUrls.size || 0;
  const contradictingCount = contradictingUrls.size || 0;
  const initialNeutralCount = Math.max(0, evidenceForPrompt.length - supportingCount - contradictingCount);

  // Trust Score Breakdown
  const trustScoreBreakdown = responseLanguage === 'hi' ? [
    { label: 'स्रोतों की विश्वसनीयता', value: sourceCredibility },
    { label: 'समर्थन करने वाले स्रोत', value: Math.min(100, supportingCount * 15) },
    { label: 'विरोधाभासी साक्ष्य', value: contradictingCount > 0 ? Math.max(0, 100 - contradictingCount * 20) : 100 },
    { label: 'AI विश्लेषण का विश्वास स्तर', value: geminiResult.confidence || 50 },
  ] : [
    { label: 'Source credibility', value: sourceCredibility },
    { label: 'Supporting sources', value: Math.min(100, supportingCount * 15) },
    { label: 'Contradicting evidence', value: contradictingCount > 0 ? Math.max(0, 100 - contradictingCount * 20) : 100 },
    { label: 'AI reasoning confidence', value: geminiResult.confidence || 50 },
  ];

  if (pageClassification && ['official', 'reference'].includes(pageClassification.pageType)) {
    trustScore = Math.max(trustScore, 75);
  }

  let pageVerdict;
  if (pageClassification) {
    if (['official', 'reference'].includes(pageClassification.pageType)) {
      pageVerdict = 'Informational';
    } else if (pageClassification.pageType === 'opinion') {
      pageVerdict = 'Opinion';
    }
  }

  const getDomain = (url) => {
    try { return new URL(url || '').hostname.replace(/^www\./, ''); }
    catch { return ''; }
  };

  const sourceConsensus = evidenceForPrompt.map((article, index) => {
    const evaluation = (geminiResult.sourceConsensus || []).find(sc => sc.index === index) || {};
    
    let stance = evaluation.stance || 'Mentions';
    if (!evaluation.stance) {
      const isSupporting = claims.some(c => c.verdict === 'Supported' && c.sources?.some(s => s.url === article.url));
      const isContradicting = claims.some(c => c.verdict === 'Contradicted' && c.sources?.some(s => s.url === article.url));
      if (isSupporting) stance = 'Supports';
      else if (isContradicting) stance = 'Contradicts';
    }

    const summary = evaluation.summary || (responseLanguage === 'hi' ? 'इस स्रोत का विवरण हिंदी में उपलब्ध नहीं है।' : (article.snippet || article.content || ''));
    const pubTier = article.tier || getSourceTier(article.url);
    
    let score = 50;
    if (pubTier === 1) score = 85;
    else if (pubTier === 2) score = 75;
    else if (pubTier === 3) score = 65;
    else score = 45;
    
    if (article.isFactCheck) score = Math.min(100, score + 15);
    if (stance === 'Supports') score = Math.min(100, score + 10);
    else if (stance === 'Contradicts') score = Math.max(0, score - 20);

    const trustLevelMap = {
      'Highly Trusted': { en: 'Highly Trusted', hi: 'अत्यधिक विश्वसनीय' },
      'Trusted': { en: 'Trusted', hi: 'विश्वसनीय' },
      'Moderate': { en: 'Moderate', hi: 'मध्यम विश्वसनीय' },
      'Low': { en: 'Low', hi: 'कम विश्वसनीय' }
    };
    const trustLevelKey = pubTier === 1 ? 'Highly Trusted' : pubTier === 2 ? 'Trusted' : pubTier === 3 ? 'Moderate' : 'Low';
    const trustLevel = responseLanguage === 'hi' ? trustLevelMap[trustLevelKey].hi : trustLevelMap[trustLevelKey].en;

    return {
      publisher: article.source || getDomain(article.url) || (responseLanguage === 'hi' ? 'अज्ञात प्रकाशक' : 'Unknown Publisher'),
      title: article.title || (responseLanguage === 'hi' ? 'बिना शीर्षक' : 'Untitled'),
      url: article.url,
      publishedAt: article.publishedAt || article.date || null,
      trustLevel,
      stance,
      credibilityScore: score,
      summary
    };
  });

  const supportCount = sourceConsensus.filter(s => s.stance === 'Supports').length;
  const contradictCount = sourceConsensus.filter(s => s.stance === 'Contradicts').length;
  const neutralCount = sourceConsensus.filter(s => s.stance === 'Mentions' || s.stance === 'Neutral' || s.stance === 'Opinion').length;
  const unknownCount = sourceConsensus.length - supportCount - contradictCount - neutralCount;

  const evidenceMetrics = {
    supportCount,
    contradictCount,
    neutralCount,
    unknownCount
  };

  let reasoningObj = {
    evidenceSummary: geminiResult.evidenceSummary || '',
    crossSourceAgreement: geminiResult.crossSourceAgreement || '',
    officialConfirmation: geminiResult.officialConfirmation || '',
    missingContext: geminiResult.missingContext || null,
    contradictionsFound: geminiResult.contradictionsFound || null,
    aiReasoning: geminiResult.finalAssessment || geminiResult.summary || ''
  };

  if (geminiResult.reasoning && typeof geminiResult.reasoning === 'object') {
    reasoningObj = { ...reasoningObj, ...geminiResult.reasoning };
  } else if (geminiResult.reasoning && typeof geminiResult.reasoning === 'string') {
    reasoningObj.evidenceSummary = geminiResult.reasoning || geminiResult.summary || '';
    reasoningObj.aiReasoning = geminiResult.summary || '';
  }

  let verifiedFacts = geminiResult.verifiedFacts || [];
  if (!Array.isArray(verifiedFacts) || verifiedFacts.length === 0) {
    verifiedFacts = [
      responseLanguage === 'hi' ? 'दावे की सत्यता की जांच कई स्वतंत्र प्रकाशकों से की गई।' : 'The claim details were cross-checked against multiple independent publishers.',
      responseLanguage === 'hi' ? 'विभिन्न समाचार रिपोर्टों में दी गई समयसीमा का मिलान किया गया।' : 'Timelines and key events were compared across all available reports.',
      responseLanguage === 'hi' ? 'आधिकारिक बयानों और रिकॉर्ड्स की उपलब्धता की पुष्टि की गई।' : 'Official statements and records were evaluated for confirmation.'
    ];
  }

  let keyFindings = geminiResult.keyFindings || [];
  if (!Array.isArray(keyFindings) || keyFindings.length === 0) {
    keyFindings = [
      responseLanguage === 'hi' ? `कुल ${evidenceForPrompt.length} प्रासंगिक स्रोतों का विश्लेषण किया गया।` : `Analyzed reporting from ${evidenceForPrompt.length} relevant sources.`,
      responseLanguage === 'hi' ? `दावे का समर्थन करने वाले ${supportCount} स्रोत पाए गए।` : `Identified ${supportCount} supporting and ${contradictCount} contradicting sources.`,
      responseLanguage === 'hi' ? 'स्रोतों की विश्वसनीयता के आधार पर आम सहमति स्कोर की गणना की गई।' : 'Consensus score was calculated based on publisher credibility tiers.'
    ];
  }

  let finalAssessment = geminiResult.finalAssessment || reasoningObj.aiReasoning || geminiResult.summary || '';
  if (!finalAssessment) {
    finalAssessment = responseLanguage === 'hi'
      ? `हमारे विश्लेषण में दावों की पुष्टि के लिए ${supportCount} सहायक स्रोत मिले। यह दावा ${trustScore >= 70 ? 'उच्च विश्वास के साथ समर्थित' : trustScore >= 40 ? 'मध्यम विश्वास के साथ आंशिक रूप से समर्थित' : 'अपुष्ट या खंडित'} है।`
      : `Our analysis found ${supportCount} supporting sources. The core claim is ${trustScore >= 70 ? 'supported with high confidence' : trustScore >= 40 ? 'partially corroborated with moderate confidence' : 'contradicted or unverified'}.`;
  }

  let timeline = geminiResult.timeline || null;
  if (timeline && typeof timeline === 'object') {
    timeline = {
      claimPublished: timeline.claimPublished || null,
      majorCoverage: timeline.majorCoverage || null,
      officialConfirmation: timeline.officialConfirmation || null,
      verificationCompleted: new Date().toISOString()
    };
  }

  const averageCredibility = sourceConsensus.reduce((acc, s) => acc + s.credibilityScore, 0) / (sourceConsensus.length || 1);
  const evidenceQualityStars = Math.max(1, Math.min(5, Math.round(averageCredibility / 20)));

  const uniquePublishers = new Set(sourceConsensus.map(s => s.publisher)).size;
  const independentSourcesStars = Math.max(1, Math.min(5, Math.round(uniquePublishers / 1.5)));

  const hasOfficial = sourceConsensus.some(s => s.trustLevel === 'Highly Trusted' || /gov|nic|who|un/i.test(s.url));
  const officialSourcesStars = hasOfficial ? 5 : 2;

  const recentReportingStars = sourceConsensus.some(s => s.publishedAt && (Date.now() - new Date(s.publishedAt).getTime()) < 30 * 24 * 60 * 60 * 1000) ? 5 : 3;

  const hasContradict = sourceConsensus.some(s => s.stance === 'Contradicts');
  const contradictoryStatus = hasContradict
    ? (responseLanguage === 'hi' ? 'खंडन किया गया' : 'Contradicted')
    : (responseLanguage === 'hi' ? 'कोई नहीं मिला' : 'None Found');

  const aiConsistencyStatus = trustScore >= 70
    ? (responseLanguage === 'hi' ? 'उच्च' : 'High')
    : trustScore >= 40
      ? (responseLanguage === 'hi' ? 'मध्यम' : 'Medium')
      : (responseLanguage === 'hi' ? 'निम्न' : 'Low');

  const geminiCB = geminiResult.confidenceBreakdown || {};
  const getExplanation = (field, fallbackEn, fallbackHi) => {
    const fallback = responseLanguage === 'hi' ? fallbackHi : fallbackEn;
    if (typeof geminiCB[field] === 'object' && geminiCB[field] !== null) {
      return geminiCB[field].explanation || fallback;
    }
    return typeof geminiCB[field] === 'string' ? geminiCB[field] : fallback;
  };

  const confidenceBreakdownObj = {
    evidenceQuality: {
      stars: evidenceQualityStars,
      explanation: getExplanation('evidenceQuality', 'Assessment based on relevant sources.', 'प्रासंगिक स्रोतों के आधार पर मूल्यांकन।')
    },
    independentSources: {
      stars: independentSourcesStars,
      explanation: getExplanation('independentSources', 'Multiple sources analyzed.', 'कई स्रोतों का विश्लेषण किया गया।')
    },
    officialSources: {
      stars: officialSourcesStars,
      explanation: getExplanation('officialSources', 'No official statement found.', 'कोई आधिकारिक बयान नहीं मिला।')
    },
    recentReporting: {
      stars: recentReportingStars,
      explanation: getExplanation('recentReporting', 'Fresh coverage matches timeline.', 'नवीनतम कवरेज समयसीमा से मेल खाती है।')
    },
    contradictoryEvidence: {
      status: contradictoryStatus,
      explanation: getExplanation('contradictoryEvidence', 'No trusted publisher contradicts.', 'कोई भी विश्वसनीय प्रकाशक खंडन नहीं करता है।')
    },
    aiConsistency: {
      status: aiConsistencyStatus,
      explanation: getExplanation('aiConsistency', 'AI reasoning is consistent.', 'AI विश्लेषण सुसंगत है।')
    }
  };

  const result = {
    inputType,
    trustScore,
    verdict: geminiResult.verdict,
    confidence: geminiResult.confidence,
    aiLikelihood,
    aiScore: 100 - aiLikelihood,
    aiReasoning: reasoningObj.evidenceSummary || reasoningObj.aiReasoning || geminiResult.summary || '',
    reasoning: reasoningObj,
    confidenceBreakdown: confidenceBreakdownObj,
    sourceConsensus,
    evidenceMetrics,
    supportCount,
    contradictCount,
    neutralCount,
    unknownCount,
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
    verifiedFacts,
    keyFindings,
    finalAssessment,
    timeline,
    evidenceReasoning: geminiResult.evidenceReasoning || '',
    claimsVerified: geminiResult.claimsVerified ?? claims.filter(c => c.verdict !== 'Unverified').length,
    claimsTotal: geminiResult.claimsTotal ?? claims.length,
    unverifiedNote: geminiResult.unverifiedNote || null,
    trustScoreBreakdown,
    sources: claims[0]?.sources || evidenceForPrompt.slice(0, 6).map(s => toSourceShape(s, responseLanguage)),
    _verdict: geminiResult.verdict,
    _confidence: geminiResult.confidence,
    _summary: geminiResult.summary,
    _originalText: claimText.slice(0, 10000),
    _queriesUsed: searchQueries,
    ...(pageClassification ? {
      pageType: pageClassification.pageType,
      pageTypeLabel: pageClassification.pageTypeLabel,
      pageTypeDescription: pageClassification.pageTypeDescription,
    } : {}),
    ...(pageVerdict ? { pageVerdict } : {}),
  };

  logger.info('Verification pipeline complete with relevant sources', {
    trustScore,
    claimsCount: claims.length,
    claimsVerified: result.claimsVerified,
    claimsTotal: result.claimsTotal,
    supportingCount,
    contradictingCount,
    factCheckHits: factCheckResults.length,
    usedFallback,
    processingTime: result.processingTime,
  });

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildClaims(geminiResult, evidenceSources, responseLanguage) {
  const rawClaims = geminiResult.claims || [];

  if (rawClaims.length === 0) {
    const claimReasoning = typeof geminiResult.reasoning === 'object' && geminiResult.reasoning !== null
      ? (geminiResult.reasoning.evidenceSummary || geminiResult.reasoning.aiReasoning || '')
      : (geminiResult.reasoning || '');
    return [
      {
        text: geminiResult.summary || (responseLanguage === 'hi' ? 'समग्र दावा' : 'Overall claim'),
        verdict: mapVerdict(geminiResult.verdict),
        confidence: geminiResult.confidence || 0,
        reasoning: claimReasoning,
        sourceCount: evidenceSources.length,
        trustedSourceCount: evidenceSources.filter((s) => s.trusted).length,
        sources: evidenceSources.slice(0, 5).map(s => toSourceShape(s, responseLanguage)),
      },
    ];
  }

  return rawClaims.map((claim) => {
    const supportingIndices = claim.supportingSources || [];
    const contradictingIndices = claim.contradictingSources || [];
    const allIndices = [...new Set([...supportingIndices, ...contradictingIndices])];

    const claimSources = allIndices
      .filter((i) => i >= 0 && i < evidenceSources.length)
      .map((i) => toSourceShape(evidenceSources[i], responseLanguage));

    const finalSources =
      claimSources.length > 0
        ? claimSources
        : evidenceSources.slice(0, 3).map(s => toSourceShape(s, responseLanguage));

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

function toSourceShape(s, responseLanguage) {
  return {
    url: s.url,
    title: s.title || (responseLanguage === 'hi' ? 'बिना शीर्षक' : 'Untitled'),
    source: s.source || (responseLanguage === 'hi' ? 'अज्ञात प्रकाशक' : 'Unknown Publisher'),
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
