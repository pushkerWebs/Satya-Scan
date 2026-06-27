/**
 * entityExtractor.js
 * Named-entity recognition (NER) and diversified search-query generation.
 *
 * Extracts: people, organisations, locations, dates, events, laws,
 * political parties, countries, cities, government agencies from a claim.
 *
 * Generates 5–8 diverse, entity-aware search queries for maximum recall.
 * Works on Hindi, English, and Hinglish text.
 */

const logger = require('../config/logger');

// ─── Entity pattern library ───────────────────────────────────────────────────

// Common Indian titles and honorifics (person detection)
const PERSON_TITLES = [
  'mr', 'mrs', 'ms', 'dr', 'prof', 'shri', 'smt', 'km', 'adv',
  'cm', 'pm', 'mp', 'mla', 'dgp', 'sp', 'ig', 'dsp', 'si',
  'constable', 'inspector', 'sub-inspector',
];

// Common Indian organisation keywords
const ORG_KEYWORDS = [
  'ministry', 'department', 'government', 'sarkar', 'vibhag',
  'court', 'high court', 'supreme court', 'tribunal', 'commission',
  'police', 'army', 'navy', 'airforce', 'cbi', 'nia', 'ed', 'it department',
  'university', 'college', 'hospital', 'isro', 'drdo', 'aiims',
  'bjp', 'congress', 'aap', 'sp', 'bsp', 'rjd', 'tmc', 'dmk', 'ysrcp',
  'iit', 'iim', 'nit',
];

// Indian and international location signals
const LOCATION_KEYWORDS = [
  // Indian states
  'andhra', 'arunachal', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat',
  'haryana', 'himachal', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh',
  'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha',
  'punjab', 'rajasthan', 'sikkim', 'tamil', 'telangana', 'tripura',
  'uttar pradesh', 'up', 'uttarakhand', 'west bengal', 'delhi', 'mumbai',
  'j&k', 'jammu', 'kashmir', 'ladakh',
  // Common cities
  'patna', 'lucknow', 'jaipur', 'bhopal', 'kolkata', 'hyderabad', 'bengaluru',
  'pune', 'chennai', 'ahmedabad', 'surat', 'kanpur', 'nagpur', 'agra',
  // Countries
  'india', 'pakistan', 'china', 'usa', 'america', 'uk', 'russia',
  'bangladesh', 'nepal', 'sri lanka', 'myanmar', 'afghanistan',
];

// Claim event keywords that should be preserved in queries
const EVENT_KEYWORDS = [
  'encounter', 'arrested', 'detained', 'killed', 'murdered', 'attacked',
  'died', 'appointed', 'resigned', 'fired', 'suspended', 'jailed',
  'convicted', 'acquitted', 'charged', 'filed', 'launched', 'inaugurated',
  'elected', 'won', 'lost', 'defeated', 'banned', 'closed', 'opened',
  'founded', 'merged', 'dissolved', 'exploded', 'crashed', 'leaked',
  // Hindi equivalents
  'mara', 'gaya', 'arrested', 'giraftaar', 'mukaabla', 'encounter',
];

// ─── Language detection ───────────────────────────────────────────────────────

/**
 * Detect whether a claim is predominantly Hindi, English or mixed (Hinglish).
 * Returns 'hi', 'en', or 'mixed'.
 */
function detectLanguage(text) {
  if (!text) return 'en';

  // Unicode range for Devanagari (Hindi)
  const devanagariChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars === 0) return 'en';

  const devanagariRatio = devanagariChars / totalChars;

  if (devanagariRatio > 0.5) return 'hi';
  if (devanagariRatio > 0.1) return 'mixed';
  return 'en';
}

// ─── Simple NER (regex + heuristic based) ────────────────────────────────────

/**
 * Extract named entities from claim text.
 * Returns: { people, organisations, locations, events, dates }
 */
function extractEntities(text) {
  if (!text) return { people: [], organisations: [], locations: [], events: [], dates: [] };

  const lower = text.toLowerCase();
  const words = text.split(/\s+/);

  // --- People: consecutive proper nouns (Title Case) not matched as locations/orgs ---
  const people = [];
  let nameBuffer = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[,.'"""]/g, '');
    const wordLower = word.toLowerCase();

    // Skip if it's a location or org keyword
    const isLocationWord = LOCATION_KEYWORDS.some((lk) => wordLower === lk.split(' ')[0]);
    const isOrgWord = ORG_KEYWORDS.includes(wordLower);

    // A proper noun: starts with uppercase letter (or Devanagari), length > 1
    const isProperNoun = /^[A-Z\u0900-\u097F]/.test(word) && word.length > 1 && !isLocationWord && !isOrgWord;
    const isTitle = PERSON_TITLES.includes(wordLower);

    if (isProperNoun || isTitle) {
      nameBuffer.push(word);
    } else {
      if (nameBuffer.length >= 2) {
        // At least 2 consecutive proper nouns → treat as a person name
        people.push(nameBuffer.join(' '));
      } else if (nameBuffer.length === 1 && PERSON_TITLES.includes(nameBuffer[0].toLowerCase())) {
        // Single title alone — not a person
      }
      nameBuffer = [];
    }
  }
  if (nameBuffer.length >= 2) people.push(nameBuffer.join(' '));

  // --- Organisations ---
  const organisations = [];
  for (const kw of ORG_KEYWORDS) {
    if (lower.includes(kw)) {
      organisations.push(kw);
    }
  }

  // --- Locations ---
  const locations = [];
  for (const lk of LOCATION_KEYWORDS) {
    if (lower.includes(lk)) {
      locations.push(lk);
    }
  }

  // --- Events ---
  const events = [];
  for (const ek of EVENT_KEYWORDS) {
    if (lower.includes(ek)) {
      events.push(ek);
    }
  }

  // --- Dates: year patterns, month names ---
  const dateMatches = text.match(/\b(19|20)\d{2}\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi) || [];
  const dates = [...new Set(dateMatches.map((d) => d.toLowerCase()))];

  return {
    people: [...new Set(people)].slice(0, 5),
    organisations: [...new Set(organisations)].slice(0, 5),
    locations: [...new Set(locations)].slice(0, 5),
    events: [...new Set(events)].slice(0, 5),
    dates,
  };
}

// ─── Diversified query generation ────────────────────────────────────────────

/**
 * Generate 5–8 diverse, entity-aware search queries from a claim.
 * Guarantees coverage of: core claim, person+context, event+location,
 * fact-check search, official statement search.
 */
function generateDiverseQueries(claimText, entities) {
  const { people, organisations, locations, events, dates } = entities;
  const queries = new Set();

  // 1. Base claim (truncated)
  const base = claimText.slice(0, 200).trim();
  queries.add(base);

  // 2. Fact-check query
  queries.add(`${base.slice(0, 150)} fact check`);

  // 3. If people found — generate person-focused queries
  for (const person of people) {
    // Person + location
    if (locations.length > 0) {
      queries.add(`${person} ${locations[0]}`);
    }
    // Person + event
    if (events.length > 0) {
      queries.add(`${person} ${events[0]}`);
    }
    // Person + fact check
    queries.add(`${person} fact check`);
    // Person + news
    queries.add(`${person} news`);
    // Person alone
    if (person.split(' ').length >= 2) {
      queries.add(person);
    }
  }

  // 4. Event + location
  if (events.length > 0 && locations.length > 0) {
    queries.add(`${events[0]} ${locations[0]}`);
  }

  // 5. Organisation + event
  if (organisations.length > 0 && events.length > 0) {
    queries.add(`${organisations[0]} ${events[0]}`);
  }

  // 6. Date-specific queries
  if (dates.length > 0 && people.length > 0) {
    queries.add(`${people[0]} ${dates[0]}`);
  }

  // 7. Official statement search
  if (people.length > 0) {
    queries.add(`${people[0]} official statement`);
  } else if (organisations.length > 0) {
    queries.add(`${organisations[0]} official statement`);
  }

  // 8. Counter-evidence / debunk search
  queries.add(`${claimText.slice(0, 100)} false misleading`);

  // Remove very short or duplicate queries, cap at 8
  const finalQueries = [...queries]
    .filter((q) => q.trim().length > 10)
    .slice(0, 8);

  logger.info(`Entity-aware query generation: ${finalQueries.length} queries for entities: people=${people.join(',')}, locations=${locations.join(',')}, events=${events.join(',')}`);

  return finalQueries;
}

/**
 * Main entry point.
 * Given a claim text, returns { entities, queries, detectedLanguage }.
 */
function analyzeClaimForSearch(claimText) {
  const detectedLanguage = detectLanguage(claimText);
  const entities = extractEntities(claimText);
  const queries = generateDiverseQueries(claimText, entities);

  return { entities, queries, detectedLanguage };
}

module.exports = { analyzeClaimForSearch, extractEntities, generateDiverseQueries, detectLanguage };
