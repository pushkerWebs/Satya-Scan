/**
 * urlClassifierService.js
 *
 * Classifies a submitted URL into one of five page types BEFORE fact verification
 * begins. Uses pure heuristic analysis (domain name, TLD, URL path patterns) — no
 * external API calls, no added latency.
 *
 * Page types
 * ──────────
 *   news         → Standard news article. Run existing pipeline unchanged.
 *   official     → Government / authoritative org page. Do NOT label True/False/Misleading.
 *   reference    → Wikipedia, Britannica, encyclopedia. Educational, not a news claim.
 *   opinion      → Blog / editorial / opinion column. Label clearly; verify facts only.
 *   social_media → Twitter/X, Facebook, Reddit, etc. Extract & verify individual claims.
 *
 * Used by: textVerificationService (URL path only).
 * Does NOT affect: text input path, image verification, Gemini service, any prompts.
 */

// ─── Domain Sets ──────────────────────────────────────────────────────────────

const SOCIAL_MEDIA_DOMAINS = new Set([
  'twitter.com', 'x.com', 't.co',
  'facebook.com', 'fb.com', 'fb.me', 'm.facebook.com',
  'instagram.com',
  'linkedin.com',
  'reddit.com', 'redd.it', 'old.reddit.com',
  'youtube.com', 'youtu.be', 'm.youtube.com',
  'tiktok.com', 'vm.tiktok.com',
  'telegram.org', 't.me',
  'threads.net',
  'quora.com',
  'pinterest.com', 'pin.it',
  'snapchat.com',
  'mastodon.social',
  'whatsapp.com',
  'koo.in',
  'sharechat.com',
]);

const REFERENCE_DOMAINS = new Set([
  'wikipedia.org',
  'britannica.com',
  'encyclopedia.com',
  'scholarpedia.org',
  'wikiquote.org',
  'wiktionary.org',
  'wikimedia.org',
  'wikiversity.org',
  'wikihow.com',
  'howstuffworks.com',
  'khanacademy.org',
  'investopedia.com',
  'merriam-webster.com',
  'dictionary.com',
  'nationalgeographic.com',
  'thoughtco.com',
  'livescience.com',
  'scientificamerican.com',
]);

// Explicit high-priority official domains (supplement TLD matching)
const OFFICIAL_DOMAINS = new Set([
  'who.int', 'un.org', 'unicef.org', 'worldbank.org', 'imf.org',
  'europa.eu', 'oecd.org', 'wto.org', 'nato.int', 'iaea.org',
  'nasa.gov', 'fda.gov', 'cdc.gov', 'nih.gov', 'epa.gov', 'hhs.gov',
  'rbi.org.in', 'sebi.gov.in', 'eci.gov.in',
  'isro.gov.in', 'india.gov.in', 'mha.gov.in', 'mea.gov.in',
  'pib.gov.in', 'icmr.gov.in', 'mohfw.gov.in', 'niti.gov.in',
  'uidai.gov.in', 'npci.org.in', 'nse.co.in', 'bse.com',
  'parliament.uk', 'gov.uk', 'whitehouse.gov', 'state.gov', 'defense.gov',
]);

// Official government / intergovernmental TLD suffixes
const OFFICIAL_TLD_SUFFIXES = [
  '.gov', '.gov.in', '.gov.uk', '.gov.au', '.gov.ca', '.gov.nz',
  '.gov.za', '.gov.sg', '.gov.ph', '.gov.bd', '.gov.pk', '.gov.lk',
  '.nic.in', '.mil', '.int',
  '.gc.ca', // Canada federal
  '.govt.nz', // New Zealand
];

// URL path segments that strongly indicate opinion / editorial / blog content
const OPINION_PATH_PATTERNS = [
  '/opinion/', '/opinions/',
  '/editorial/', '/editorials/',
  '/blog/', '/blogs/',
  '/column/', '/columns/',
  '/commentary/', '/commentaries/',
  '/viewpoint/', '/viewpoints/',
  '/perspective/', '/perspectives/',
  '/op-ed/', '/opeds/', '/oped/',
  '/guest-post/', '/guest/',
  '/analysis/', // Some outlets use this for opinion-style analysis
  '/author/', '/writers/',
  '/contributors/', '/contributor/',
];

// Blog / opinion platform domains
const OPINION_DOMAINS = new Set([
  'medium.com',
  'substack.com',
  'wordpress.com',
  'blogspot.com',
  'blogger.com',
  'tumblr.com',
  'ghost.io',
  'beehiiv.com',
  'hashnode.dev',
  'dev.to',
  'hackernoon.com',
  'speakingoftrees.com',
]);

// ─── Classification Logic ─────────────────────────────────────────────────────

const DEFAULT_CLASSIFICATION = {
  pageType: 'news',
  pageTypeLabel: 'News Article',
  pageTypeDescription: 'This page is treated as a news article. Factual claims are extracted and verified against independent sources.',
};

/**
 * Classify a URL into one of five page types.
 *
 * @param {string} url  — The original URL submitted by the user
 * @returns {{ pageType: string, pageTypeLabel: string, pageTypeDescription: string }}
 */
function classifyUrl(url) {
  if (!url || typeof url !== 'string') return DEFAULT_CLASSIFICATION;

  let hostname = '';
  let pathname = '';

  try {
    const parsed = new URL(url.trim());
    hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    // Malformed URL — default to news
    return DEFAULT_CLASSIFICATION;
  }

  // ── 1. Social media ──────────────────────────────────────────────────────
  if (
    SOCIAL_MEDIA_DOMAINS.has(hostname) ||
    [...SOCIAL_MEDIA_DOMAINS].some((d) => hostname.endsWith('.' + d))
  ) {
    return {
      pageType: 'social_media',
      pageTypeLabel: 'Social Media Post',
      pageTypeDescription:
        'This content is from a social media platform. Individual factual claims in the post are extracted and verified independently against trusted sources.',
    };
  }

  // ── 2. Reference / knowledge page ────────────────────────────────────────
  if (
    REFERENCE_DOMAINS.has(hostname) ||
    [...REFERENCE_DOMAINS].some((d) => hostname.endsWith('.' + d))
  ) {
    return {
      pageType: 'reference',
      pageTypeLabel: 'Reference / Knowledge Page',
      pageTypeDescription:
        'This is an educational reference page (e.g. Wikipedia, Britannica). It provides established knowledge and is not a news claim — it is not evaluated as true or false.',
    };
  }

  // ── 3. Official government or organization page ───────────────────────────
  const isOfficialDomain =
    OFFICIAL_DOMAINS.has(hostname) ||
    [...OFFICIAL_DOMAINS].some((d) => hostname.endsWith('.' + d));

  const isOfficialTLD = OFFICIAL_TLD_SUFFIXES.some((tld) => hostname.endsWith(tld));

  if (isOfficialDomain || isOfficialTLD) {
    return {
      pageType: 'official',
      pageTypeLabel: 'Official Information Page',
      pageTypeDescription:
        'This is an official government or authoritative organization page. Its content is treated as authoritative information — it is not labelled True, False, or Misleading by default.',
    };
  }

  // ── 4. Opinion / blog — by URL path patterns ──────────────────────────────
  if (OPINION_PATH_PATTERNS.some((p) => pathname.includes(p))) {
    return {
      pageType: 'opinion',
      pageTypeLabel: 'Blog / Opinion Content',
      pageTypeDescription:
        'This page contains opinion or editorial content. Factual statements are identified and verified separately from opinions.',
    };
  }

  // ── 5. Opinion / blog — by domain ────────────────────────────────────────
  if (
    OPINION_DOMAINS.has(hostname) ||
    [...OPINION_DOMAINS].some((d) => hostname.endsWith('.' + d))
  ) {
    return {
      pageType: 'opinion',
      pageTypeLabel: 'Blog / Opinion Content',
      pageTypeDescription:
        'This page is hosted on a blog or opinion platform. Factual statements are identified and verified separately from personal opinions.',
    };
  }

  // ── Default: treat as a news article ─────────────────────────────────────
  return DEFAULT_CLASSIFICATION;
}

module.exports = { classifyUrl };
