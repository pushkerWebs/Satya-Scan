const Tesseract = require('tesseract.js');
const logger = require('../config/logger');

/**
 * Local OCR Fallback Engine using Tesseract.js
 * Runs when Gemini Vision OCR is rate-limited, throttled, or offline.
 * Extracts English and Hindi text from image buffer.
 */
async function extractTextWithTesseract(imageBuffer) {
  logger.info('[Tesseract OCR] Starting local OCR fallback extraction');
  try {
    const { data } = await Tesseract.recognize(
      imageBuffer,
      'eng',
      {
        errorHandler: err => logger.warn('[Tesseract OCR] Worker warning:', err),
      }
    );

    const cleaned = (data?.text || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    logger.info('[Tesseract OCR] Local OCR completed successfully', {
      length: cleaned.length,
      preview: cleaned.slice(0, 120),
    });

    return cleaned;
  } catch (err) {
    logger.error('[Tesseract OCR] Local OCR extraction failed:', err);
    console.error(err);
    return null;
  }
}

module.exports = { extractTextWithTesseract };
