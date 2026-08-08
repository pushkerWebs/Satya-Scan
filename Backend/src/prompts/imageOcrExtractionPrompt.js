/**
 * OCR Extraction Prompt - Module 2 (Text Claim Verification)
 *
 * Extracts text and determines whether the extracted text makes a verifiable factual claim.
 */
function buildOcrExtractionPrompt(language) {
  const styleLanguage = language === 'hi' ? 'Hindi and English' : 'English and Hindi';

  return `You are an expert Optical Character Recognition (OCR) and claim extraction system.

SUPPORTED LANGUAGES: ${styleLanguage}, and any mix of both.

TASK 1: TEXT EXTRACTION
Extract all readable text visible in the image (preserving original wording and spelling).

TASK 2: MEANINGFUL FACTUAL CLAIM DETECTION
Determine if the extracted text makes a meaningful, verifiable factual claim (e.g. news events, political statements, celebrity assertions, sports events, scientific claims, statistics, or public controversies).

EXAMPLES OF MEANINGFUL FACTUAL CLAIMS (isFactualClaim: true):
- "Alia went to Latent"
- "India won the World Cup"
- "NASA confirms alien life"
- "This politician was arrested"
- "Government announces new subsidy policy"

EXAMPLES OF NON-CLAIMS (isFactualClaim: false):
- Greetings / Single words: "Hello", "Hi", "Hey", "Good morning"
- Social media calls-to-action: "Subscribe", "Follow me", "Follow for more", "Link in bio", "Like & Share"
- Reaction words / emojis: "LOL", "LMAO", "OMG", "Cool"
- Brand logos / decorative words: "Nike", "Apple", "Menu", "Home", "Search", "Profile"
- Watermarks / camera stamps: "Shot on iPhone", "Getty Images", "Shutterstock", "12:30 PM"
- Random decorative slogans: "Live Laugh Love", "Stay Positive"

If the image contains no readable text, OR the text does NOT contain a verifiable factual claim, set isFactualClaim to false and detectedClaim to null.

RESPONSE FORMAT (JSON ONLY):
{
  "hasText": true | false,
  "extractedText": "<all extracted text as a single string, or null if none>",
  "isFactualClaim": true | false,
  "detectedClaim": "<the specific factual claim sentence to verify, or null if not a claim>",
  "primaryLanguage": "en | hi | mixed | unknown"
}`;
}

module.exports = { buildOcrExtractionPrompt };
