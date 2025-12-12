// COMPLETE WEB SEARCH ENGINE WITH REAL WEB CRAWLER
// Fetches live web pages, indexes them, and searches with TF-IDF

const axios = require('axios');
const cheerio = require('cheerio');

// ============ GLOBAL CACHE & CRAWL STATE ============
const crawlCache = {}; // URL -> {title, content, timestamp}
const visitedUrls = new Set();
const MAX_CRAWL_TIME = 8000; // 8 second timeout for serverless
const MAX_PAGES = 10; // Crawl max 10 pages per search query

// ============ SEED URLs FOR CRAWLER ============
const SEED_URLS = [
  'https://en.wikipedia.org/wiki/JavaScript',
  'https://www.python.org/',
  'https://reactjs.org/',
  'https://openai.com/',
  'https://developer.mozilla.org/en-US/docs/Web/',
  'https://www.w3schools.com/'
];

// ============ STOP WORDS ============
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it',
  'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they',
  'this', 'to', 'was', 'will', 'with', 'from', 'has', 'have', 'had', 'do', 'does', 'did', 'page'
]);

// ============ WEB CRAWLER ============
async function crawlPage(url, depth = 0) {
  if (depth > 2 || visitedUrls.size >= MAX_PAGES || visitedUrls.has(url)) {
    return null;
  }

  try {
    visitedUrls.add(url);
    console.log(`[CRAWLER] Fetching: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 3000,
      maxRedirects: 2
    });

    const $ = cheerio.load(response.data);
    
    // Extract title
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';
    
    // Extract main content (remove scripts, styles, nav, etc)
    $('script, style, nav, footer, .nav, .sidebar').remove();
    const content = $('body').text()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000); // Limit to 5000 chars

    if (content.length < 100) {
      return null; // Skip pages with too little content
    }

    // Cache the crawled page
    crawlCache[url] = {
      title,
      content,
      timestamp: Date.now()
    };

    // Extract and queue new links (only same domain)
    const links = [];
    $('a[href]').each((i, elem) => {
      let href = $(elem).attr('href');
      if (href && !href.startsWith('#')) {
        try {
          href = new URL(href, url).href;
          const domain = new URL(url).hostname;
          const linkDomain = new URL(href).hostname;
          if (domain === linkDomain && links.length < 3) {
            links.push(href);
          }
        } catch (e) {}
      }
    });

    // Recursively crawl discovered links (non-blocking)
    for (const link of links) {
      if (visitedUrls.size < MAX_PAGES) {
        crawlPage(link, depth + 1).catch(() => {});
      }
    }

    return { title, content, url };
  } catch (error) {
    console.error(`[CRAWLER] Error fetching ${url}:`, error.message);
    return null;
  }
}

// ============ TOKENIZER ============
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

// ============ BUILD INVERTED INDEX FROM CRAWLED DATA ============
function buildInvertedIndex(documents) {
  const invertedIndex = {};
  const docFrequency = {};
  
  for (const [docId, doc] of Object.entries(documents)) {
    const tokens = tokenize(doc.title + ' ' + doc.content);
    const termFreq = {};
    
    for (const token of tokens) {
      termFreq[token] = (termFreq[token] || 0) + 1;
    }
    
    for (const [token, freq] of Object.entries(termFreq)) {
      if (!invertedIndex[token]) {
        invertedIndex[token] = {};
        docFrequency[token] = 0;
      }
      invertedIndex[token][docId] = freq;
      docFrequency[token]++;
    }
  }
  
  return { invertedIndex, docFrequency };
}

// ============ TF-IDF RANKING ============
function calculateTFIDF(documents, invertedIndex, docFrequency, query) {
  const queryTokens = tokenize(query);
  const scores = {};
  const totalDocs = Math.max(Object.keys(documents).length, 1);
  
  for (const token of queryTokens) {
    if (!invertedIndex[token]) continue;
    
    const idf = Math.log(totalDocs / (docFrequency[token] || 1));
    
    for (const [docId, termFreq] of Object.entries(invertedIndex[token])) {
      const docLength = Object.values(invertedIndex)
        .reduce((sum, docTerms) => sum + (docTerms[docId] ? 1 : 0), 0);
      const tf = termFreq / Math.max(docLength, 1);
      const tfidf = tf * idf;
      
      scores[docId] = (scores[docId] || 0) + tfidf;
    }
  }
  
  return scores;
}

// ============ SEARCH WITH LIVE CRAWLING ============
async function search(query, limit = 15) {
  const startTime = Date.now();
  
  // Trigger crawler for seed URLs if cache is empty
  if (Object.keys(crawlCache).length === 0) {
    console.log('[SEARCH] Cold start - triggering crawler...');
    // Start crawling in background (non-blocking)
    SEED_URLS.slice(0, 3).forEach(url => {
      crawlPage(url).catch(() => {});
    });
    
    // Wait a bit for initial results
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Build index from currently crawled pages
  const { invertedIndex, docFrequency } = buildInvertedIndex(crawlCache);
  const scores = calculateTFIDF(crawlCache, invertedIndex, docFrequency, query);
  
  // Rank and return results
  const results = Object.entries(scores)
    .map(([docId, score]) => ({
      title: crawlCache[docId].title,
      url: docId,
      snippet: crawlCache[docId].content.substring(0, 150) + '...',
      score
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => ({ title: r.title, url: r.url, snippet: r.snippet }));
  
  // If no results, add seed URLs as fallback
  if (results.length === 0) {
    SEED_URLS.slice(0, 3).forEach(url => {
      results.push({
        title: 'See: ' + url,
        url,
        snippet: 'Related resource for your query'
      });
    });
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[SEARCH] Query "${query}" completed in ${elapsed}ms with ${results.length} results`);
  
  return results;
}

// ============ API HANDLER ============
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { query, limit = 15 } = req.query;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter required',
      results: []
    });
  }

  try {
    // Reset crawl state per request (can also use persistent cache)
    if (Math.random() > 0.7) visitedUrls.clear();
    
    const results = await search(query, parseInt(limit) || 15);
    
    return res.status(200).json({
      success: true,
      query,
      results,
      count: results.length,
      crawledPages: Object.keys(crawlCache).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Search error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      results: []
    });
  }
};
