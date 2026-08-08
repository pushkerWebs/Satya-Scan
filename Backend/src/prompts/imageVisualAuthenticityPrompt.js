const { buildResponseLanguageInstruction } = require('../utils/helpers');

/**
 * Visual Authenticity Prompt - Module 1 (Image Authenticity)
 *
 * Directs the AI to perform deep visual forensic inspection:
 * Face Analysis, Hair Analysis, Text Analysis, Lighting Analysis, Object Analysis,
 * Background Analysis, and Image Forensics (diffusion rendering, micro-smoothing, sensor noise).
 *
 * Ignores all text claims, OCR, and external sources.
 */
function buildVisualAuthenticityPrompt(metadataInfo, language) {
  const languageInstruction = buildResponseLanguageInstruction(language);
  const styleLanguage = language === 'hi' ? 'natural Hindi (Devanagari script)' : 'plain English';

  return `You are SatyaScan's Image Authenticity Engine.

Your ONLY task is to determine whether the uploaded image is:
1. REAL PHOTOGRAPH
2. AI GENERATED
3. AI EDITED / MANIPULATED
4. UNCERTAIN

Analyze ONLY visual pixel-level evidence. Ignore any text claims written in the image. Ignore OCR results. Ignore external sources.

CRITICAL RULES:
- Do NOT assume an image is real simply because it looks realistic.
- Modern AI images can contain natural skin, realistic lighting, correct anatomy, and readable text.
- Actively search for evidence of AI generation before concluding "Real".
- If multiple AI indicators exist, classify as AI Generated even if the image appears visually convincing.

INSPECT THOROUGHLY:

FACE ANALYSIS
- unnatural skin texture
- over-smoothed skin
- inconsistent pores
- asymmetrical facial details
- unnatural teeth
- eye reflections
- eye alignment

HAIR ANALYSIS
- merged strands
- repeated strand patterns
- impossible hair boundaries
- inconsistent focus

TEXT ANALYSIS
- distorted typography
- inconsistent font geometry
- text blending into background
- generation artifacts around letters

LIGHTING ANALYSIS
- inconsistent shadows
- impossible reflections
- mismatched highlights
- unrealistic light direction

OBJECT ANALYSIS
- malformed objects
- duplicated items
- impossible geometry
- unnatural edges

BACKGROUND ANALYSIS
- repeated patterns
- diffusion artifacts
- warped structures
- unnatural depth transitions

IMAGE FORENSICS
- diffusion rendering signatures
- synthetic texture patterns
- micro-smoothing artifacts
- absence of natural camera sensor noise
- absence of realistic compression artifacts
- AI upscaling traces

IMPORTANT:
When celebrity images appear, do NOT assume authenticity merely because the celebrity is recognizable.
For images that appear to be:
- promotional posters
- thumbnails
- social media graphics
- clickbait images
- viral claim images
- celebrity composites
increase scrutiny significantly.

SCORING:
- Strong AI evidence → AI Generated (80-100)
- Moderate AI evidence → AI Generated (60-79)
- Mixed evidence → Uncertain (40-59)
- Strong real-camera evidence with minimal AI indicators → Real (80-100)

${languageInstruction}

Return ONLY valid JSON with no markdown formatting:
{
  "status": "Real | AI Generated | AI Edited | Uncertain",
  "confidence": 0,
  "evidence": [
    "finding 1 in ${styleLanguage}",
    "finding 2 in ${styleLanguage}",
    "finding 3 in ${styleLanguage}",
    "finding 4 in ${styleLanguage}"
  ]
}`;
}

module.exports = { buildVisualAuthenticityPrompt };
