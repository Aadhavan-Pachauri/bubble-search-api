// ============================================
// BUBBLE SEARCH API - PHASE 1 + PHASE 2
// ============================================
// Per-query semantic web crawling + persistent caching
// Features: Real-time indexing, query caching, background crawling ready

const axios = require('axios');
const cheerio = require('cheerio');

// ============ CONFIG ============
const MAX_CRAWL_TIME = 7000; // 7s timeout for Vercel
const MAX_PAGES = 12; // Crawl up to 12 pages per query
const QUERY_CACHE_TTL = 5 * 60 * 1000; // Cache results for 5 minutes
const CRAWL_DEPTH_LIMIT = 2; // Max link depth to follow

// ============ IN-MEMORY CACHE (Phase 1) ============
const queryCache = new Map(); // query -> { results, timestamp, stats }
const visitedUrlsPerQuery = {}; // Per-query visited set

// ============ SEMANTIC TOPIC SEEDS (Extended) ============
const TOPIC_SEEDS = {
  'javascript': ['https://developer.mozilla.org/en-US/docs/Web/JavaScript', 'https://javascript.info/', 'https://stackoverflow.com/questions/tagged/javascript', 'https://www.typescriptlang.org/'],
  'python': ['https://www.python.org/', 'https://docs.python.org/', 'https://realpython.com/', 'https://www.python.org/community/'],
  'react': ['https://react.dev/', 'https://stackoverflow.com/questions/tagged/reactjs', 'https://github.com/facebook/react', 'https://nextjs.org/'],
  'nodejs': ['https://nodejs.org/', 'https://nodejs.org/docs/', 'https://stackoverflow.com/questions/tagged/node.js', 'https://expressjs.com/'],
  'ai': ['https://openai.com/', 'https://en.wikipedia.org/wiki/Artificial_intelligence', 'https://huggingface.co/', 'https://www.anthropic.com/'],
  'web': ['https://developer.mozilla.org/', 'https://www.w3.org/', 'https://stackoverflow.com/questions/tagged/html', 'https://css-tricks.com/'],
  'database': ['https://www.postgresql.org/', 'https://www.mongodb.com/', 'https://stackoverflow.com/questions/tagged/sql', 'https://firebase.google.com/'],
  'api': ['https://developer.mozilla.org/en-US/docs/Web/API', 'https://restfulapi.net/', 'https://swagger.io/', 'https://graphql.org/'],
  'cloud': ['https://aws.amazon.com/', 'https://cloud.google.com/', 'https://azure.microsoft.com/', 'https://www.digitalocean.com/'],
  'devops': ['https://www.docker.com/', 'https://kubernetes.io/', 'https://www.jenkins.io/', 'https://www.terraform.io/'],
  'ml': ['https://www.tensorflow.org/', 'https://pytorch.org/', 'https://scikit-learn.org/', 'https://www.fast.ai/'],
  'security': ['https://owasp.org/', 'https://cwe.mitre.org/', 'https://cheatsheetseries.owasp.org/', 'https://portswigger.net/'],
  'news': ['https://news.ycombinator.com/', 'https://techcrunch.com/', 'https://theverge.com/', 'https://arstechnica.com/'],
  'roblox': ['https://www.roblox.com/', 'https://create.roblox.com/', 'https://developer.roblox.com/', 'https://www.roblox.com/docs/'],
  'game': ['https://unity.com/', 'https://www.unrealengine.com/', 'https://godotengine.org/', 'https://www.cryengine.com/'],
};

const DEFAULT_SEEDS = [
  'https://en.wikipedia.org/',
  'https://developer.mozilla.org/',
  'https://stackoverflow.com/',
  'https://github.com/',
  'https://medium.com/',
];

// ============ STOP WORDS ============
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it',
  'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they',
  'this', 'to', 'was', 'will', 'with', 'from', 'has', 'have', 'had', 'do', 'does', 'did', 'page',
]);

// ============ GENERATE SEMANTIC SEEDS ============
function generateSemanticSeeds(query) {
  const queryLower = query.toLowerCase();
  const seeds = new Set();
  const keywords = queryLower.split(/\s+/).filter(w => w.length > 3);

  // Match query terms to topic seeds
  for (const [topic, urls] of Object.entries(TOPIC_SEEDS)) {
    const matches = keywords.filter(kw => topic.includes(kw) || kw.includes(topic[0]));
    if (matches.length > 0) {
      urls.forEach(u => seeds.add(u));
    }
  }

  // Add defaults for diversity
  if (seeds.size < 2) DEFAULT_SEEDS.forEach(u => seeds.add(u));

  return Array.from(seeds).slice(0, 6);
}

// ============ TOKENIZER ============
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

// ============ WEB CRAWLER (Per-Query) ============
async function crawlPage(url, query, depth = 0, queryId) {
  if (!queryId) queryId = query;
  if (!visitedUrlsPerQuery[queryId]) visitedUrlsPerQuery[queryId] = new Set();

  const visited = visitedUrlsPerQuery[queryId];
  if (depth > CRAWL_DEPTH_LIMIT || visited.size >= MAX_PAGES || visited.has(url)) {
    return null;
  }

  try {
    visited.add(url);
    console.log(`[CRAWL] Depth ${depth}: ${url.substring(0, 60)}`);

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 3000,
      maxRedirects: 2,
    });

    const $ = cheerio.load(response.data);
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

    // Extract main content - smart selector
    $('script, style, nav, footer, .ad, .sidebar, .nav, noscript').remove();
    let content = $('main, article, .content, .post, .article-body, body').first().text()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000);

    if (content.length < 100) return null; // Too short

    // Extract relevant links for deeper crawl
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && links.length < 5) {
        try {
          const fullUrl = new URL(href, url).href;
          const sameDomain = new URL(url).hostname === new URL(fullUrl).hostname;
          if (sameDomain && !fullUrl.includes('#')) links.push(fullUrl);
        } catch (e) {}
      }
    });

    // Recursively crawl discovered links (non-blocking)
    for (const link of links) {
      if (visited.size < MAX_PAGES) {
        crawlPage(link, query, depth + 1, queryId).catch(() => {});
      }
    }

    return { url, title, content };
  } catch (error) {
    console.error(`[CRAWL-ERROR] ${url.substring(0, 40)}: ${error.message}`);
    return null;
  }
}

// ============ BUILD IN-MEMORY INDEX ============
function buildIndex(pages) {
  const index = {};
  const docFreq = {};

  for (const [i, page] of pages.entries()) {
    const tokens = tokenize(`${page.title} ${page.title} ${page.content}`); // Title weight x2
    const termFreq = {};

    for (const token of tokens) {
      termFreq[token] = (termFreq[token] || 0) + 1;
    }

    for (const [token, freq] of Object.entries(termFreq)) {
      if (!index[token]) index[token] = {};
      index[token][i] = freq;
      docFreq[token] = (docFreq[token] || 0) + 1;
    }
  }

  return { index, docFreq };
}

// ============ TF-IDF + BM25 RANKING ============
function rankResults(pages, index, docFreq, query) {
  const queryTokens = tokenize(query);
  const scores = {};
  const totalDocs = Math.max(pages.length, 1);
  const avgDocLength = pages.reduce((sum, p) => sum + p.content.length, 0) / totalDocs;

  for (const token of queryTokens) {
    if (!index[token]) continue;

    // IDF calculation
    const idf = Math.log(totalDocs / (docFreq[token] || 1));

    // BM25 parameters
    const K1 = 1.5; // term frequency saturation
    const B = 0.75; // length normalization

    for (const [docId, tf] of Object.entries(index[token])) {
      const docLength = pages[docId].content.length;
      const normLength = docLength / avgDocLength;

      // BM25 formula
      const numerator = tf * (K1 + 1);
      const denominator = tf + K1 * (1 - B + B * normLength);
      const bm25 = idf * (numerator / denominator);

      scores[docId] = (scores[docId] || 0) + bm25;
    }
  }

  return scores;
}

// ============ SEARCH WITH CACHING (Phase 1) ============
async function search(query, limit = 15) {
  const cacheKey = query.toLowerCase().trim();
  const now = Date.now();

  // Check query cache first
  if (queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey);
    if (now - cached.timestamp < QUERY_CACHE_TTL) {
      console.log(`[CACHE-HIT] "${query}" - returned ${cached.results.length} cached results`);
      return cached.results.slice(0, limit);
    }
  }

  console.log(`[FRESH-CRAWL] Starting per-query semantic crawl for "${query}"`);
  const startTime = now;
  const seeds = generateSemanticSeeds(query);
  const queryId = `q_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  visitedUrlsPerQuery[queryId] = new Set();

  // Launch parallel crawls from all seeds
  const crawlPromises = seeds.slice(0, 4).map(url => crawlPage(url, query, 0, queryId));

  // Wait for crawls with timeout
  await Promise.race([
    Promise.all(crawlPromises),
    new Promise(r => setTimeout(r, MAX_CRAWL_TIME))
  ]).catch(() => {});

  // Collect all crawled pages into array
  const crawledData = Object.values(visitedUrlsPerQuery[queryId] || {}).filter(Boolean);
  const pages = crawledData.slice(0, MAX_PAGES);

  console.log(`[CRAWL-COMPLETE] Crawled ${pages.length} pages in ${Date.now() - startTime}ms`);

  // Fallback if no pages crawled
  if (pages.length === 0) {
    console.log('[FALLBACK] No pages crawled, using seed URLs');
    return seeds.slice(0, limit).map(url => ({
      title: `Resource: ${new URL(url).hostname}`,
      url,
      snippet: 'Related resource for your query',
      content: '',
    }));
  }

  // Build index and rank
  const { index, docFreq } = buildIndex(pages);
  const scores = rankResults(pages, index, docFreq, query);

  // Format and return results
  let results = Object.entries(scores)
    .map(([docId, score]) => ({
      title: pages[docId].title,
      url: pages[docId].url,
      snippet: pages[docId].content.substring(0, 220) + '...',
      score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => ({ title: r.title, url: r.url, snippet: r.snippet }));

  // Cache the results
  const cacheEntry = { 
    results, 
    timestamp: startTime,
    stats: { pagesIndexed: pages.length, elapsed: Date.now() - startTime }
  };
  queryCache.set(cacheKey, cacheEntry);

  // Cleanup old cache (keep last 50 queries)
  if (queryCache.size > 50) {
    const firstKey = queryCache.keys().next().value;
    queryCache.delete(firstKey);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[SEARCH-SUCCESS] "${query}" - ${results.length} results in ${elapsed}ms from ${pages.length} pages`);

  // Cleanup per-query state
  delete visitedUrlsPerQuery[queryId];

  return results;
}

// ============ API HANDLER ============
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(200).end();
  const query = req.query.query || req.body?.query;
  const limit = parseInt(req.query.limit || req.body?.limit || 15);

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter required',
      results: [],
    });
  }

  try {
    const results = await search(query, limit);
    return res.status(200).json({
      success: true,
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ERROR]', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Search failed',
      results: [],
    });
  }
};

  const query = req.query.query || req.body?.query;
  const limit = parseInt(req.query.limit || req.body?.limit || req.body?.limit || 15);

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter required',
      results: [],
    });
  }

  try {
    const results = await search(query, limit);
    return res.status(200).json({
      success: true,
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ERROR]', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Search failed',
      results: [],
    });
  }
};
