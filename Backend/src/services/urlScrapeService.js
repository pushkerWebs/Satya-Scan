const axios = require('axios');
const logger = require('../config/logger');

/**
 * Extract text content from a URL using simple HTTP fetch + HTML tag stripping.
 * No Puppeteer — uses plain HTTP with a browser-like User-Agent.
 */
async function extractTextFromUrl(url) {
  logger.info(`Scraping URL: ${url}`);

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
      },
      responseType: 'text',
    });

    const html = response.data;

    if (!html || typeof html !== 'string') {
      throw new Error('Empty response from URL');
    }

    // Extract text content from HTML
    let text = html;

    // Remove script and style tags and their content
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
    text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

    // Try to extract main article content
    const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

    if (articleMatch) {
      text = articleMatch[1];
    } else if (mainMatch) {
      text = mainMatch[1];
    }

    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&#x27;/g, "'");
    text = text.replace(/&#x2F;/g, '/');

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Limit to reasonable length
    if (text.length > 10000) {
      text = text.slice(0, 10000);
    }

    if (text.length < 50) {
      throw new Error('Extracted text too short — page may require JavaScript rendering');
    }

    logger.info(`Extracted ${text.length} characters from URL`);
    return text;
  } catch (error) {
    if (error.response) {
      logger.error(`URL scrape HTTP error ${error.response.status} for ${url}`);
      throw new Error(`Could not fetch URL (HTTP ${error.response.status})`);
    }
    logger.error(`URL scrape failed for ${url}:`, error.message);
    throw new Error(`Could not extract content from URL: ${error.message}`);
  }
}

module.exports = { extractTextFromUrl };
