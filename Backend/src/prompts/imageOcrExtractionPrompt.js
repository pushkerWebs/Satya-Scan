/**
 * OCR Extraction Prompt - Module 2 (Text Claim Verification)
 *
 * Extracts text and determines the core assertion for fact-checking.
 */
function buildOcrExtractionPrompt(language) {
  const styleLanguage = language === 'hi' ? 'Hindi and English' : 'English and Hindi';

  return `You are an expert Optical Character Recognition (OCR) system.

SUPPORTED LANGUAGES: ${styleLanguage}, and any mix of both.

TASK:
1. Extract ALL visible text from the image verbatim (headlines, meme captions, video overlays, news banners, social media posts, subtitles).
2. If ANY visible text is present (e.g. "ALIA ATTENDED INDIA'S GOT LATENT", "India won the match", "Breaking News: ..."), you MUST extract it into "extractedText" and set "hasText": true.
3. Identify the primary factual assertion or headline claim in "detectedClaim".

EXAMPLES OF VALID EXTRACTIONS:
- Image contains: "ALIA ATTENDED INDIA'S GOT LATENT" -> extractedText: "ALIA ATTENDED INDIA'S GOT LATENT", hasText: true, isFactualClaim: true
- Image contains: "PM announces new economic package" -> extractedText: "PM announces new economic package", hasText: true, isFactualClaim: true
- Image contains only: "Hello" / "Subscribe" / "❤️" -> extractedText: "Hello", hasText: true, isFactualClaim: false
- Image contains no text at all -> extractedText: null, hasText: false, isFactualClaim: false

You MUST respond with ONLY a valid JSON object. No markdown fences, no explanatory text outside JSON.

RESPONSE FORMAT (JSON ONLY):
{
  "hasText": true,
  "extractedText": "<all extracted text as a single string, or null if none>",
  "detectedClaim": "<the specific factual claim sentence to verify, or null if not a claim>",
  "isFactualClaim": true,
  "primaryLanguage": "en | hi | mixed | unknown"
}`;
}

module.exports = { buildOcrExtractionPrompt };
