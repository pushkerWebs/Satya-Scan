/**
 * openaiService.js
 * OpenAI GPT-4o fallback reasoning engine.
 * Used ONLY when Gemini is unavailable.
 * Mirrors the geminiService public interface exactly so the caller needs
 * no changes beyond catching both error types.
 *
 * API key is read from OPENAI_API_KEY env variable — never hard-coded.
 */

const OpenAI = require('openai');
const logger = require('../config/logger');
const { OPENAI_API_KEY } = require('../config/env');

let openaiClient = null;

function getClient() {
  if (!OPENAI_API_KEY) {
    throw new OpenAIProviderError('OPENAI_API_KEY is not configured', null);
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return openaiClient;
}

class OpenAIProviderError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'OpenAIProviderError';
    this.cause = cause;
    this.statusCode = 503;
    this.provider = 'openai';
  }
}

/**
 * Parse JSON from OpenAI response (handles markdown fences).
 */
function parseOpenAIJSON(text) {
  if (!text) throw new OpenAIProviderError('Empty response from OpenAI', null);
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new OpenAIProviderError(
      `Failed to parse OpenAI response as JSON: ${err.message}\nRaw: ${text.slice(0, 300)}`,
      err
    );
  }
}

/**
 * analyzeText — drop-in replacement for geminiService.analyzeText.
 * Sends the same verification prompt to GPT-4o and returns identical
 * JSON structure expected by textVerificationService.
 */
async function analyzeText(prompt) {
  logger.info('Sending text analysis request to OpenAI (Gemini fallback)');

  const client = getClient();

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a professional fact-checker. Respond ONLY with valid JSON matching the schema provided in the user message. Never add explanation outside the JSON object.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const text = completion.choices[0]?.message?.content || '';
    logger.info('OpenAI text analysis response received');
    return parseOpenAIJSON(text);
  } catch (error) {
    console.error("========== OPENAI ERROR ==========");
console.dir(error, { depth: null });
console.error("=================================");
    throw error instanceof OpenAIProviderError
      ? error
      : new OpenAIProviderError('OpenAI text analysis unavailable', error);
  }
}

/**
 * generateSearchQueries — drop-in replacement for geminiService.generateSearchQueries.
 */
async function generateSearchQueries(prompt) {
  logger.info('Generating search queries via OpenAI (Gemini fallback)');

  const client = getClient();

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a search query generator. Return ONLY a JSON object with a "queries" array of strings.',
        },
        {
          role: 'user',
          content: prompt + '\n\nReturn format: {"queries": ["query1", "query2", ...]}',
        },
      ],
    });

    const text = completion.choices[0]?.message?.content || '';
    const parsed = parseOpenAIJSON(text);
    const queries = Array.isArray(parsed) ? parsed : (parsed.queries || []);
    logger.info(`OpenAI generated ${queries.length} search queries`);
    return queries;
  } catch (error) {
    logger.warn('OpenAI query generation failed:', error.message);
    return [];
  }
}

module.exports = { analyzeText, generateSearchQueries, OpenAIProviderError };
