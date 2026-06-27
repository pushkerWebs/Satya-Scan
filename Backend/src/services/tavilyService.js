/**
 * tavilyService.js
 * Tavily search integration with tiered trust enrichment.
 *
 * Primary search: NO domain restriction so broad evidence can be found.
 * Fact-check specific search: targeted at known fact-check / govt domains.
 * All results sorted by trust tier then relevance score.
 */

const axios = require('axios');
const logger = require('../config/logger');
const { TAVILY_API_KEY } = require('../config/env');
const {
  deduplicateByKey,
  isTrustedSource,
  extractDomain,
  getSourceTier,
  TIER1_SOURCES,
  TIER2_SOURCES,
} = require('../utils/helpers');

const TAVILY_API_URL = 'https://api.tavily.com/search';

// Domains prioritised in the "trusted" subset search
const TRUSTED_INCLUDE_DOMAINS = [
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk',
  'indianexpress.com', 'thehindu.com', 'ndtv.com',
  'theguardian.com', 'nytimes.com', 'washingtonpost.com',
  'pib.gov.in', 'who.int', 'un.org',
  'factcheck.org', 'snopes.com', 'politifact.com',
  'altnews.in', 'boomlive.in', 'factly.in', 'newschecker.in',
  'mha.gov.in', 'mea.gov.in', 'india.gov.in',
  'afp.com', 'dw.com', 'aljazeera.com', 'theprint.in',
  'scroll.in', 'thewire.in', 'livemint.com', 'business-standard.com',
];

/**
 * Single Tavily search.
 * restrictToTrusted=true  → include_domains filter (for fact-check targeted pass)
 * restrictToTrusted=false → open search (primary broad retrieval)
 */
async function searchSingle(query, restrictToTrusted = false) {
  const payload = {
    api_key: TAVILY_API_KEY,
    query,
    search_depth: 'advanced',
    include_answer: false,
    include_raw_content: false,
    max_results: restrictToTrusted ? 5 : 7,
  };

  if (restrictToTrusted) {
    payload.include_domains = TRUSTED_INCLUDE_DOMAINS;
  }

  try {
    const response = await axios.post(TAVILY_API_URL, payload, { timeout: 12000 });
    const results = response.data?.results || [];
    logger.debug(`Tavily "${query.slice(0, 60)}" → ${results.length} results (trusted=${restrictToTrusted})`);
    return results;
  } catch (error) {
    logger.warn(`Tavily failed for query "${query.slice(0, 60)}":`, error.message);

    // Fallback: basic search without domain restriction
    try {
      const fallbackResponse = await axios.post(
        TAVILY_API_URL,
        {
          api_key: TAVILY_API_KEY,
          query,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
          max_results: 5,
        },
        { timeout: 8000 }
      );
      return fallbackResponse.data?.results || [];
    } catch (fallbackError) {
      logger.error('Tavily fallback also failed:', fallbackError.message);
      return [];
    }
  }
}

/**
 * Search with multiple queries in parallel.
 * Runs two passes:
 *   Pass A — open broad search for all queries (primary coverage)
 *   Pass B — trusted-domain-restricted search for the first 2 queries (quality boost)
 * Merges, deduplicates, enriches, and ranks by trust tier then relevance.
 */
async function searchMultiple(queries) {
  logger.info(`Searching Tavily with ${queries.length} queries (hybrid: open + trusted pass)`);

  // Pass A: open search across all queries
  const openSearches = queries.map((q) => searchSingle(q, false));

  // Pass B: trusted-domain search for first 2 queries
  const trustedSearches = queries.slice(0, 2).map((q) => searchSingle(q, true));

  const allSettled = await Promise.allSettled([...openSearches, ...trustedSearches]);

  const flatResults = [];
  for (const result of allSettled) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      flatResults.push(...result.value);
    }
  }

  logger.info(`Tavily returned ${flatResults.length} total results (before dedup)`);

  // Deduplicate by URL
  const uniqueResults = deduplicateByKey(flatResults, 'url');
  logger.info(`After dedup: ${uniqueResults.length} unique results`);

  // Enrich with trust info and tier
  const enrichedResults = uniqueResults.map((r) => {
    const tier = getSourceTier(r.url);
    return {
      url: r.url,
      title: r.title || 'Untitled',
      content: r.content || r.raw_content || '',
      snippet: r.content ? r.content.slice(0, 300) : '',
      source: extractDomain(r.url),
      trusted: isTrustedSource(r.url),
      tier,
      score: r.score || 0,
      isFactCheck: false,
    };
  });

  // Sort: fact-checks first, then by tier (lower = better), then relevance score
  enrichedResults.sort((a, b) => {
    if (a.isFactCheck && !b.isFactCheck) return -1;
    if (!a.isFactCheck && b.isFactCheck) return 1;
    const tierDiff = (a.tier || 4) - (b.tier || 4);
    if (tierDiff !== 0) return tierDiff;
    return (b.score || 0) - (a.score || 0);
  });

  return enrichedResults;
}

module.exports = { searchSingle, searchMultiple };
