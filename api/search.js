// COMPLETE WEB SEARCH ENGINE WITH SEMANTIC WEB CRAWLER
// Fetches live web pages, indexes them, searches with TF-IDF
// Generates relevant seed URLs based on query topics

const axios = require('axios');
const cheerio = require('cheerio');

// ============ GLOBAL CACHE & CRAWL STATE ============
const crawlCache = {}; // URL -> {title, content, timestamp}
const visitedUrls = new Set();
const MAX_CRAWL_TIME = 8000; // 8 second timeout for serverless
const MAX_PAGES = 15; // Crawl max 15 pages per search query

// ============ SEMANTIC URL GENERATOR ============
// Maps topics to relevant seed URLs for crawling
const TOPIC_SEEDS = {
  'javascript': [
    'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    'https://en.wikipedia.org/wiki/JavaScript',
    'https://www.w3schools.com/js/'
  ],
  'python': [
    'https://www.python.org/',
    'https://en.wikipedia.org/wiki/Python_(programming_language)',
    'https://docs.python.org/'
  ],
  'react': [
    'https://react.dev/',
    'https://en.wikipedia.org/wiki/React_(JavaScript_library)',
    'https://developer.mozilla.org/en-US/docs/Glossary/React'
  ],
  'ai': [
    'https://en.wikipedia.org/wiki/Artificial_intelligence',
    'https://www.ibm.com/topics/artificial-intelligence',
    'https://openai.com/'
  ],
  'web': [
    'https://developer.mozilla.org/en-US/docs/Web/',
    'https://www.w3schools.com/',
    'https://www.w3.org/'
  ],
  'machine learning': [
    'https://en.wikipedia.org/wiki/Machine_learning',
    'https://www.tensorflow.org/',
    'https://scikit-learn.org/'
  ],
  'data science': [
    'https://en.wikipedia.org/wiki/Data_science',
    'https://pandas.pydata.org/',
    'https://www.kaggle.com/'
  ],
  'node': [
    'https://nodejs.org/',
    'https://en.wikipedia.org/wiki/Node.js',
    'https://www.w3schools.com/nodejs/'
  ],
  'api': [
    'https://en.wikipedia.org/wiki/API',
    'https://www.postman.com/',
    'https://swagger.io/'
  ],
  'database': [
    'https://en.wikipedia.org/wiki/Database',
    'https://www.mongodb.com/',
    'https://www.postgresql.org/'
  ],
  'cloud': [
    'https://en.wikipedia.org/wiki/Cloud_computing',
    'https://aws.amazon.com/',
    'https://cloud.google.com/'
  ],
  'devops': [
    'https://en.wikipedia.org/wiki/DevOps',
    'https://www.docker.com/',
    'https://kubernetes.io/'
  ]
};

// ============ DEFAULT FALLBACK SEEDS ============
const DEFAULT_SEEDS = [
  'https://en.wikipedia.org/wiki/Technology',
  'https://developer.mozilla.org/en-US/docs/Web/',
  'https://www.w3schools.com/',
  'https://stackoverflow.com/',
  'https://github.com/'
];

// ============ SEMANTIC SEED URL GENERATOR ============
function generateSemanticSeeds(query) {
  const queryLower = query.toLowerCase();
  const seedCandidates = new Set();

  // Check if query matches any topic directly
  for (const [topic, urls] of Object.entries(TOPIC_SEEDS)) {
    if (queryLower.includes(topic) || topic.includes(queryLower.split(' ')[0])) {
      urls.forEach(url => seedCandidates.add(url));
    }
  }

  // If no semantic matches, use defaults
  if (seedCandidates.size === 0) {
    DEFAULT_SEEDS.forEach(url => seedCandidates.add(url));
  }

  // Mix in a couple of defaults for diversity
  seedCandidates.add(DEFAULT_SEEDS[0]);
  seedCandidates.add(DEFAULT_SEEDS[3]);

  return Array.from(seedCandidates).slice(0, 6); // Return max 6 seeds
}

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

// ============ SEARCH WITH SEMANTIC CRAWLING ============
async function search(query, limit = 15) {
  const startTime = Date.now();

  // Generate semantic seeds based on query
  const semanticSeeds = generateSemanticSeeds(query);
  console.log(`[SEARCH] Query: "${query}" -> Generated seeds:`, semanticSeeds);

  // Reset visited URLs for fresh crawl per query
  visitedUrls.clear();

  // Trigger crawler for semantic seeds (non-blocking)
  semanticSeeds.slice(0, 4).forEach(url => {
    crawlPage(url).catch(() => {});
  });

  // Wait for initial crawl results
  await new Promise(r => setTimeout(r, 2000));

  // Build index from crawled pages
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

  // If no results, add semantic seeds as fallback
  if (results.length === 0) {
    semanticSeeds.slice(0, 3).forEach(url => {
      results.push({
        title: 'See: ' + url,
        url,
        snippet: 'Related resource for your query'
      });
    });
  }

  const elapsed = Date.now() - startTime;
  console.log(`[SEARCH] Query "${query}" completed in ${elapsed}ms with ${results.length} results from ${Object.keys(crawlCache).length} pages`);

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
