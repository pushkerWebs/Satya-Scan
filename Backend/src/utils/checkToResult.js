/**
 * Transform a stored Check document into the same shape returned by POST /api/analyze.
 * Used when reopening history — no AI recompute.
 */
function checkToResult(check) {
  const checkId = check._id?.toString?.() || check._id;

  if (check.inputType === 'image') {
    return {
      inputType: 'image',
      trustScore: check.trustScore,
      verdict: check.imageVerdict,
      confidence: check.imageConfidence,
      aiProbability: check.aiProbability,
      deepfakeProbability: check.deepfakeProbability,
      manipulationProbability: check.manipulationProbability,
      metadataIntegrity: check.metadataIntegrity,
      findings: check.findings || [],
      summary: check.imageSummary,
      language: check.language,
      detectedLanguage: check.detectedLanguage,
      responseLanguage: check.responseLanguage,
      processingTime: check.processingTime,
      checkId,
    };
  }

  const aiReasoning =
    check.aiReasoning ||
    (check.claims || [])
      .map((c) => c.reasoning)
      .filter(Boolean)
      .slice(0, 3)
      .join(' ');

  const result = {
    inputType: check.inputType,
    trustScore: check.trustScore,
    aiLikelihood: check.aiScore != null ? 100 - check.aiScore : undefined,
    aiScore: check.aiScore,
    aiReasoning,
    sourceCredibility: check.sourceScore,
    language: check.language,
    detectedLanguage: check.detectedLanguage,
    responseLanguage: check.responseLanguage,
    claims: check.claims || [],
    processingTime: check.processingTime,
    checkId,
  };

  if (check.pageType) {
    result.pageType = check.pageType;
    result.pageTypeLabel = check.pageTypeLabel;
    result.pageTypeDescription = check.pageTypeDescription;
  }
  if (check.pageVerdict) {
    result.pageVerdict = check.pageVerdict;
  }

  return result;
}

module.exports = checkToResult;
