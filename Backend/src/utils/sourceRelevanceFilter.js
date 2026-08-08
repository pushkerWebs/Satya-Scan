/**
 * sourceRelevanceFilter.js
 * High-precision semantic & entity relevance filter for retrieved sources.
 *
 * Ensures sources actually discuss the specific claim and its core entities
 * (e.g. "Alia Bhatt", "India's Got Latent") rather than unrelated government/UN documents.
 */

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'her', 'here', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s',
  'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to',
  'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'were', 'weren\'t', 'what', 'when', 'where', 'which',
  'while', 'who', 'whom', 'why', 'with', 'won\'t', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

// Generic country/filler words that should not alone qualify a source as relevant
const GENERIC_FILLER_WORDS = new Set(['india', 'indian', 'indias', 'news', 'report', 'video', 'watch', 'official', 'statement', 'attended', 'event', 'today', 'daily']);

function extractClaimKeywords(claimText) {
  if (!claimText || typeof claimText !== 'string') return [];
  const normalized = claimText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  return [...new Set(normalized.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w)))];
}

/**
 * Extract named entity tokens from claim text (e.g. "alia", "latent", "bhatt")
 */
function extractCoreEntities(claimText, entityObj = {}) {
  const entities = new Set();
  const people = entityObj.people || [];
  const locations = entityObj.locations || [];
  const events = entityObj.events || [];
  const orgs = entityObj.organisations || [];

  [...people, ...locations, ...events, ...orgs].forEach(e => {
    e.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach(token => {
      if (token.length >= 3 && !STOP_WORDS.has(token) && !GENERIC_FILLER_WORDS.has(token)) {
        entities.add(token);
      }
    });
  });

  // Extract capitalized words or significant nouns from original claim
  const words = claimText.split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (clean.length >= 3 && !STOP_WORDS.has(clean) && !GENERIC_FILLER_WORDS.has(clean)) {
      entities.add(clean);
    }
  }

  return [...entities];
}

/**
 * Compute semantic relevance between a source and a claim.
 * Returns a score between 0.0 and 1.0.
 */
function computeSourceRelevance(source, claimText, coreEntities = []) {
  if (!source || !claimText) return 0;

  const claimKeywords = extractClaimKeywords(claimText);
  if (claimKeywords.length === 0) return 1.0;

  const title = (source.title || '').toLowerCase();
  const snippet = (source.snippet || source.content || '').toLowerCase();
  const url = (source.url || '').toLowerCase();
  const combinedText = `${title} ${title} ${snippet} ${url}`; // Double-weight title

  // 1. Strictly reject generic government / UN / WHO documents for non-governmental claims
  const isGenericGovUn = /un\.org|who\.int|dea\.gov\.in|digitallibrary\.un\.org|hlpf\.un\.org|legal\.un\.org/i.test(url);
  const claimHasGovContext = /government|un\b|who\b|treaty|health|law|court|policy|ministry|minister|pib|rbi|sebi|treaties/i.test(claimText);
  if (isGenericGovUn && !claimHasGovContext) {
    return 0.0;
  }

  // 2. Specific Entity Match: If claim has specific subject entities (e.g. "alia", "latent"),
  // at least ONE primary entity MUST appear in the source title or body!
  const specificEntities = coreEntities.filter(e => e.length >= 3 && !GENERIC_FILLER_WORDS.has(e));
  if (specificEntities.length > 0) {
    const matchedSpecific = specificEntities.filter(ent => combinedText.includes(ent));
    if (matchedSpecific.length === 0) {
      return 0.0; // Zero entity overlap = completely unrelated
    }
  }

  // 3. Keyword Overlap Ratio
  let matchedKeywords = 0;
  for (const kw of claimKeywords) {
    if (combinedText.includes(kw)) {
      matchedKeywords++;
    }
  }
  const keywordOverlap = matchedKeywords / claimKeywords.length;

  // 4. Require minimum 40% keyword overlap for general sources
  if (keywordOverlap < 0.4) {
    return 0.0;
  }

  // Bonus for title matching
  let score = keywordOverlap;
  if (specificEntities.some(ent => title.includes(ent))) {
    score += 0.2;
  }

  return Math.min(1.0, score);
}

/**
 * Filter and prune candidate sources to keep only genuinely relevant sources.
 */
function filterRelevantSources(sources = [], claimText, entityObj = {}, minThreshold = 0.40) {
  if (!Array.isArray(sources) || sources.length === 0) return [];
  const coreEntities = extractCoreEntities(claimText, entityObj);

  const scoredSources = sources.map(source => {
    const relevance = computeSourceRelevance(source, claimText, coreEntities);
    return {
      ...source,
      relevanceScore: relevance
    };
  });

  // Filter sources meeting the minimum relevance threshold
  const relevant = scoredSources.filter(s => s.relevanceScore >= minThreshold);

  // Sort by relevance score descending
  relevant.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return relevant;
}

module.exports = {
  extractClaimKeywords,
  extractCoreEntities,
  computeSourceRelevance,
  filterRelevantSources
};
