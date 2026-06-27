const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('../config/env');
const logger = require('../config/logger');
const { parseGeminiJSON } = require('../utils/helpers');



const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || 'missing-key');

console.log("Gemini model:", GEMINI_MODEL);

class GeminiProviderError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'GeminiProviderError';
    this.cause = cause;
    this.statusCode = 503;
    this.provider = 'gemini';
    this.retryable = isRetryableGeminiError(cause);
    this.serviceBlocked = isServiceBlockedError(cause);
  }
}
function getErrorMessage(error) {
  return error?.message || String(error);
}

function isServiceBlockedError(error) {
  const message = getErrorMessage(error);
  return (
    message.includes('API_KEY_SERVICE_BLOCKED') ||
    message.includes('Requests to this API') ||
    message.includes('403 Forbidden')
  );
}

function isRetryableGeminiError(error) {
  const message = getErrorMessage(error);
  return (
    message.includes('429') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    /timeout|ECONNRESET|ETIMEDOUT/i.test(message)
  );
}

async function withRetry(operation, label, maxAttempts = 2) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (isServiceBlockedError(error) || !isRetryableGeminiError(error) || attempt === maxAttempts) {
        break;
      }

      const delayMs = 400 * attempt;
      logger.warn(`${label} failed; retrying`, {
        attempt,
        delayMs,
        error: getErrorMessage(error),
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new GeminiProviderError(`${label} unavailable`, lastError);
}

async function analyzeText(prompt) {
  logger.info('Sending text analysis request to Gemini');
  logger.debug('Prompt length:', prompt.length);

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });

  try {
    const result = await withRetry(
      () => model.generateContent(prompt),
      'Gemini text analysis'
    );
    const response = result.response;
    const text = response.text();

    logger.info('Gemini text analysis response received');
    logger.debug('Response length:', text.length);

    return parseGeminiJSON(text);
  } catch (error) {
  console.log("========== GEMINI ERROR ==========");
  console.dir(error, { depth: null });
  console.log("==================================");

  logger.error("Gemini text analysis failed:", getErrorMessage(error));

  throw error instanceof GeminiProviderError
    ? error
    : new GeminiProviderError("Gemini text analysis unavailable", error);
}
}

async function analyzeImage(imageBuffer, mimeType, prompt) {
  logger.info('Sending image analysis request to Gemini Vision');

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  try {
    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType || 'image/jpeg',
      },
    };

    const result = await withRetry(
      () => model.generateContent([prompt, imagePart]),
      'Gemini image analysis'
    );
    const response = result.response;
    const text = response.text();

    logger.info('Gemini image analysis response received');
    logger.debug('Response length:', text.length);

    return parseGeminiJSON(text);
  } catch (error) {
    logger.error('Gemini image analysis failed:', getErrorMessage(error));
    throw error instanceof GeminiProviderError
      ? error
      : new GeminiProviderError('Gemini image analysis unavailable', error);
  }
}

async function generateSearchQueries(prompt) {
  logger.info('Generating search queries via Gemini');

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
  });

  try {
    const result = await withRetry(
      () => model.generateContent(prompt),
      'Gemini query generation'
    );
    const text = result.response.text();
    const queries = parseGeminiJSON(text);

    if (!Array.isArray(queries)) {
      logger.warn('Gemini returned non-array for queries, wrapping');
      return [queries.toString()];
    }

    logger.info(`Generated ${queries.length} search queries`);
    return queries;
  } catch (error) {
    logger.warn('Failed to generate search queries:', getErrorMessage(error));
    return [];
  }
}

module.exports = {
  analyzeText,
  analyzeImage,
  generateSearchQueries,
  GeminiProviderError,
};

