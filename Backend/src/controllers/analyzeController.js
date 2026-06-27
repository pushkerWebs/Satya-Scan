const { verifyText } = require('../services/textVerificationService');
const { verifyImage } = require('../services/imageVerificationService');
const Check = require('../models/Check');
const logger = require('../config/logger');

/**
 * POST /api/analyze
 *
 * Routes to the correct pipeline based on `type`:
 * - text/url → textVerificationService (Tavily + Gemini)
 * - image → imageVerificationService (EXIF + Gemini Vision)
 *
 * Images NEVER enter the fact-checking pipeline.
 * Text NEVER enters the image pipeline.
 */
async function analyze(req, res, next) {
  try {
    const { type, content, selectedLanguage } = req.body;

    logger.info('Analyze request received', {
      type,
      selectedLanguage,
      userId: req.userId || 'anonymous',
      contentLength: content?.length || 0,
      hasFile: !!req.file,
    });

    let result;

    // ─── Route to correct pipeline ─────────────────────────────────────
    if (type === 'text' || type === 'url') {
      // TEXT / URL PIPELINE — Tavily + Gemini
      result = await verifyText(content, type, selectedLanguage);
    } else if (type === 'image') {
      // IMAGE PIPELINE — EXIF + Gemini Vision (NO Tavily, NO web search)
      if (!req.file) {
        return res.status(400).json({ message: 'Image file is required' });
      }
      result = await verifyImage(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
        selectedLanguage
      );
    } else {
      return res.status(400).json({ message: 'Invalid analysis type' });
    }

    // ─── Save to history if authenticated ──────────────────────────────
    let checkId = null;
    if (req.userId) {
      try {
        const checkData = buildCheckDocument(req.userId, type, content, result);
        const check = await Check.create(checkData);
        checkId = check._id;
        logger.info('Check saved to history', { checkId, userId: req.userId });
      } catch (saveError) {
        // Don't fail the whole request if save fails
        logger.error('Failed to save check to history:', saveError.message);
      }
    }

    // ─── Return response ───────────────────────────────────────────────
    // Remove internal fields (prefixed with _)
    const response = { ...result, checkId };
    Object.keys(response).forEach((key) => {
      if (key.startsWith('_')) delete response[key];
    });

    res.json(response);
  } catch (error) {
    logger.error('Analysis failed:', {
      message: error.message,
      type: req.body?.type,
    });
    next(error);
  }
}

/**
 * Build a Check document from the analysis result.
 */
function buildCheckDocument(userId, inputType, content, result) {
  const base = {
    userId,
    inputType,
    language: result.language,
    detectedLanguage: result.detectedLanguage,
    responseLanguage: result.responseLanguage,
    selectedLanguage: result._selectedLanguage,
    processingTime: result.processingTime,
  };

  if (inputType === 'text' || inputType === 'url') {
    return {
      ...base,
      originalText: result._originalText || content?.slice(0, 10000),
      trustScore: result.trustScore,
      aiScore: result.aiScore,
      sourceScore: result.sourceCredibility,
      claims: result.claims?.map((c) => ({
        text: c.text,
        verdict: c.verdict,
        confidence: c.confidence,
        reasoning: c.reasoning,
        sourceCount: c.sourceCount,
        trustedSourceCount: c.trustedSourceCount,
        sources: c.sources?.map((s) => ({
          url: s.url,
          title: s.title,
          source: s.source,
          trusted: s.trusted,
        })),
      })) || [],
    };
  }

  // Image
  return {
    ...base,
    originalText: result._originalFilename || 'Image upload',
    trustScore: result.trustScore,
    imageVerdict: result.verdict,
    imageConfidence: result.confidence,
    aiProbability: result.aiProbability,
    deepfakeProbability: result.deepfakeProbability,
    manipulationProbability: result.manipulationProbability,
    metadataIntegrity: result.metadataIntegrity,
    findings: result.findings,
    imageSummary: result.summary,
  };
}

module.exports = { analyze };
