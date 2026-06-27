/**
 * factCheckService.js
 * Queries the Google Fact Check Tools API.
 * Returns structured fact-check results as high-priority evidence sources.
 *
 * API docs: https://developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search
 */

const axios = require('axios');
const logger = require('../config/logger');
const { FACT_CHECK_API_KEY } = require('../config/env');

const FACT_CHECK_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

// Publisher names considered "official" fact-check organisations
const FACT_CHECK_TIER1_ORGS = [
  'snopes', 'politifact', 'factcheck.org', 'reuters', 'ap', 'associated press',
  'bbc', 'altnews', 'boomlive', 'vishvasnews', 'factly', 'india today',
  'the quint', 'newschecker', 'logically', 'leadstories', 'fullfact',
];

/**
 * Search the Google Fact Check API for a given claim text.
 * Returns an array of enriched evidence source objects compatible with the
 * rest of the pipeline (same shape as tavilyService output).
 */
async function searchFactCheck(claimText) {
  if (!FACT_CHECK_API_KEY) {
    logger.warn('FACT_CHECK_API_KEY not set — skipping Google Fact Check API');
    return [];
  }

  const query = claimText.slice(0, 500); // API limit

  try {
    logger.info(`Querying Google Fact Check API: "${query.slice(0, 80)}..."`);

    const response = await axios.get(FACT_CHECK_URL, {
      params: {
        key: FACT_CHECK_API_KEY,
        query,
        languageCode: 'en',
        pageSize: 10,
      },
      timeout: 8000,
    });

    const claims = response.data?.claims || [];
    logger.info(`Google Fact Check API returned ${claims.length} fact-checked claims`);

    if (claims.length === 0) return [];

    // Normalise into evidence source objects
    const results = [];
    for (const item of claims) {
      const reviews = item.claimReview || [];
      for (const review of reviews) {
        const publisher = review.publisher?.name || review.publisher?.site || 'Unknown';
        const orgLower = publisher.toLowerCase();
        const isTier1 = FACT_CHECK_TIER1_ORGS.some((o) => orgLower.includes(o));

        results.push({
          url: review.url || '',
          title: `[FACT CHECK] ${publisher}: ${review.textualRating || 'Rated'} — "${(item.text || '').slice(0, 120)}"`,
          content: buildFactCheckContent(item, review),
          snippet: buildFactCheckSnippet(item, review),
          source: publisher,
          // Fact-check results are always trusted — they are the gold standard
          trusted: true,
          isFactCheck: true,               // flag for downstream prioritisation
          factCheckTier: isTier1 ? 1 : 2,
          rating: review.textualRating || null,
          claimDate: item.claimDate || null,
          reviewDate: review.reviewDate || null,
          // High relevance score so they sort to the top
          score: isTier1 ? 1.0 : 0.85,
        });
      }
    }

    logger.info(`Normalised ${results.length} fact-check reviews from Google Fact Check API`);
    return results;
  } catch (error) {
    logger.warn('Google Fact Check API failed:', error.message);
    return [];
  }
}

function buildFactCheckContent(item, review) {
  const lines = [];
  if (item.text) lines.push(`ORIGINAL CLAIM: "${item.text}"`);
  if (item.claimant) lines.push(`CLAIMANT: ${item.claimant}`);
  if (review.textualRating) lines.push(`OFFICIAL RATING: ${review.textualRating}`);
  if (review.title) lines.push(`FACT-CHECK TITLE: ${review.title}`);
  if (review.publisher?.name) lines.push(`PUBLISHED BY: ${review.publisher.name}`);
  if (review.reviewDate) lines.push(`REVIEW DATE: ${review.reviewDate}`);
  if (item.claimDate) lines.push(`CLAIM DATE: ${item.claimDate}`);
  return lines.join('\n');
}

function buildFactCheckSnippet(item, review) {
  const rating = review.textualRating ? `Rating: ${review.textualRating}. ` : '';
  const org = review.publisher?.name ? `Checked by ${review.publisher.name}. ` : '';
  const claim = item.text ? `Claim: "${item.text.slice(0, 150)}"` : '';
  return `${rating}${org}${claim}`.trim();
}

module.exports = { searchFactCheck };
