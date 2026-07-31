/**
 * src/services/verifyService.js
 *
 * Calls the SatyaScan backend to verify a piece of selected text.
 *
 * Responsibilities:
 *  - Build the correct request payload for the /api/analyze endpoint
 *  - Handle HTTP-level errors (non-2xx responses)
 *  - Return a normalized result object to the caller
 *
 * Does NOT interact with Chrome APIs — stays pure and testable.
 */

import { ANALYZE_ENDPOINT, MAX_TEXT_LENGTH } from '../lib/config';

/**
 * Verify a piece of user-selected text against the SatyaScan backend.
 *
 * @param {string} text - The highlighted text to verify (max 10,000 chars)
 * @returns {Promise<VerifyResult>} Normalized result object
 * @throws {Error} If the network request fails or the backend returns an error
 */
export async function verifySelectedText(text, responseLanguage = 'en', token = null) {
  if (!text || typeof text !== 'string') {
    return {
      success: false,
      errorType: 'default',
      statusCode: 400,
      message: responseLanguage === 'hi' ? 'सत्यापन के लिए कोई टेक्स्ट नहीं दिया गया।' : 'No text provided for verification.',
      devDetails: 'Validation error: Empty or invalid text string'
    };
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return {
      success: false,
      errorType: 'default',
      statusCode: 400,
      message: responseLanguage === 'hi' ? 'चयनित टेक्स्ट खाली है।' : 'Selected text is empty.',
      devDetails: 'Validation error: Text is whitespace only'
    };
  }

  if (trimmed.length > MAX_TEXT_LENGTH) {
    return {
      success: false,
      errorType: 'default',
      statusCode: 400,
      message: responseLanguage === 'hi'
        ? `चयनित टेक्स्ट बहुत लंबा है (${trimmed.length} वर्ण)। अधिकतम: ${MAX_TEXT_LENGTH}।`
        : `Selected text is too long (${trimmed.length} chars). Max allowed: ${MAX_TEXT_LENGTH}.`,
      devDetails: `Validation error: Text length ${trimmed.length} > ${MAX_TEXT_LENGTH}`
    };
  }

  const payload = {
    type: 'text',
    content: trimmed,
    responseLanguage: responseLanguage,
  };

  const requestUrl = ANALYZE_ENDPOINT;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('[VerifyService] POST /api/analyze');
  console.log('[VerifyService] Fetch URL:', requestUrl);
  console.log('[VerifyService] Request body:', JSON.stringify(payload));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn('[VerifyService] Aborting request due to 25s timeout');
    controller.abort();
  }, 25000);

  const startTime = Date.now();
  let response;
  let rawText = '';
  let data = null;

  try {
    console.log('[VerifyService] Fetch started with 25s AbortController timeout...');
    response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (networkError) {
    const duration = Date.now() - startTime;
    const isTimeout = networkError.name === 'AbortError';
    console.error('[VerifyService] Fetch failed:', networkError);
    console.error('[VerifyService] Response time (failed):', duration + 'ms');

    return {
      success: false,
      errorType: isTimeout ? '504' : 'network',
      statusCode: isTimeout ? 504 : 0,
      message: isTimeout
        ? (responseLanguage === 'hi' ? 'सत्यापन अनुरोध पूरा होने में बहुत अधिक समय लगा।' : 'The verification request took too long to complete.')
        : (responseLanguage === 'hi' ? 'सत्यास्कैन सर्वर तक पहुँचने में असमर्थ। कृपया अपना इंटरनेट कनेक्शन जाँचें।' : 'Unable to reach the SatyaScan servers. Please check your internet connection.'),
      evidenceCollected: false,
      devDetails: isTimeout ? 'Request timed out after 25,000ms' : (networkError.message || 'Fetch network failure')
    };
  } finally {
    clearTimeout(timeoutId);
  }

  const duration = Date.now() - startTime;
  const status = response.status;
  console.log('[VerifyService] Response status:', status, 'Time:', duration + 'ms');

  try {
    rawText = await response.text();
    console.log('[VerifyService] Raw response text length:', rawText.length);
  } catch (textErr) {
    console.error('[VerifyService] Failed reading response text:', textErr);
    rawText = '';
  }

  try {
    if (rawText) {
      data = JSON.parse(rawText);
      console.log('[VerifyService] JSON parsed successfully');
    }
  } catch (parseError) {
    console.error('[VerifyService] JSON parse error:', parseError.message);
  }

  // Handle explicit non-ok HTTP status codes or backend failure payloads
  if (!response.ok || (data && data.success === false)) {
    console.warn('[VerifyService] Error response detected. Status:', status, 'Data:', data);
    const errorType = String(status || data?.errorType || 'default');
    const devDetails = data?.message || data?.error || rawText.slice(0, 300) || `HTTP ${status} ${response.statusText}`;

    let message = data?.message;
    if (!message) {
      if (status === 503) {
        message = responseLanguage === 'hi'
          ? 'एआई सेवा पर इस समय अत्यधिक ट्रैफ़िक है। कृपया कुछ क्षणों बाद पुनः प्रयास करें।'
          : 'The AI service is currently experiencing high demand. Please try again in a few moments.';
      } else if (status === 403) {
        message = responseLanguage === 'hi'
          ? 'एआई कुंजी अमान्य या अनुपलब्ध होने के कारण अनुरोध अस्वीकृत कर दिया गया।'
          : 'The AI service rejected the request because the API key is invalid or unavailable.';
      } else if (status === 401) {
        message = responseLanguage === 'hi'
          ? 'प्रमाणीकरण समाप्त या अमान्य है। कृपया पुनः साइन इन करें।'
          : 'Authentication expired or invalid. Please sign in again.';
      } else if (status === 429) {
        message = responseLanguage === 'hi'
          ? 'अत्यधिक अनुरोध। कृपया पुनः प्रयास करने से पहले कुछ क्षण प्रतीक्षा करें।'
          : 'Too many requests. Please wait a moment before trying again.';
      } else if (status === 504) {
        message = responseLanguage === 'hi'
          ? 'सत्यापन अनुरोध पूरा होने में बहुत अधिक समय लगा।'
          : 'The verification request took too long to complete.';
      } else if (status >= 500) {
        message = responseLanguage === 'hi'
          ? 'अनुरोध संसाधित करते समय सर्वर में आंतरिक त्रुटि हुई।'
          : 'The server encountered an internal error while processing the request.';
      } else {
        message = responseLanguage === 'hi'
          ? 'इस दावे की पुष्टि करते समय कुछ अप्रत्याशित त्रुटि हुई।'
          : 'Something unexpected happened while verifying this claim.';
      }
    }

    return {
      success: false,
      errorType,
      statusCode: status || 500,
      message,
      evidenceCollected: data?.evidenceCollected || false,
      devDetails
    };
  }

  if (!data) {
    console.log('[VerifyService] No parsed data available');
    return {
      success: false,
      errorType: '502',
      statusCode: 502,
      message: responseLanguage === 'hi'
        ? 'सर्वर से अमान्य प्रतिक्रिया प्राप्त हुई।'
        : 'Received an invalid response from the upstream server.',
      evidenceCollected: false,
      devDetails: 'Invalid JSON payload returned by backend'
    };
  }

  console.log('[VerifyService] Normalizing successful result');
  return normalizeResult(data, trimmed);
}

/**
 * Map the raw backend response to a clean, stable shape.
 * If the backend schema changes, only this function needs updating.
 *
 * @param {object} data - Raw backend response
 * @param {string} originalText - The text that was verified
 * @returns {VerifyResult}
 */
function normalizeResult(data, originalText) {
  // Pull the first claim's verdict/confidence if claims exist
  const firstClaim = Array.isArray(data.claims) && data.claims.length > 0
    ? data.claims[0]
    : null;

  return {
    ...data,
    /** Top-level verdict string e.g. "Likely False", "Likely True" */
    verdict: data.pageVerdict
      || firstClaim?.verdict
      || data.verdict
      || 'Unverified',

    /** Trust score 0–100 */
    trustScore: typeof data.trustScore === 'number' ? data.trustScore : null,

    /** Confidence 0–1 from the first claim */
    confidence: typeof firstClaim?.confidence === 'number'
      ? firstClaim.confidence
      : null,

    /** Human-readable explanation */
    explanation: firstClaim?.reasoning
      || (Array.isArray(data.aiReasoning) ? data.aiReasoning.join(' ') : data.aiReasoning)
      || 'No explanation available.',

    /** The text that was verified (truncated for display) */
    originalText: originalText,

    /** All raw claims for potential future use */
    claims: data.claims || [],

    /** ISO timestamp */
    verifiedAt: data.verifiedAt || new Date().toISOString(),

    /** Response language from backend */
    responseLanguage: data.responseLanguage || 'en',
  };
}



/**
 * @typedef {object} VerifyResult
 * @property {string}      verdict       - Verdict label
 * @property {number|null} trustScore    - 0–100 trust score
 * @property {number|null} confidence    - 0–1 confidence from first claim
 * @property {string}      explanation   - Human-readable reasoning
 * @property {string}      originalText  - Truncated input text
 * @property {Array}       claims        - All raw claims
 * @property {string}      verifiedAt    - ISO timestamp
 */
