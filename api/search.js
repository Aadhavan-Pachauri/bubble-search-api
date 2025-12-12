const axios = require('axios');
const cheerio = require('cheerio');

// Cache for search results (1 hour TTL)
const resultCache = new Map();
const CACHE_TTL = 3600000;

// Real DuckDuckGo scraper
async function scrapeDuckDuckGo(query, limit = 15) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/?q=${encodedQuery}`;

    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const results = [];

    // Extract results from DuckDuckGo HTML structure
    $('[data-testid="result"]').each((index, element) => {
      if (results.length >= limit) return;
      
      const titleElem = $(element).find('[data-testid="result-title-a"]');
      const snippetElem = $(element).find('[data-testid="result-snippet"]');
      
      const title = titleElem.text().trim();
      const url = titleElem.attr('href');
      const snippet = snippetElem.text().trim();

      if (title && url && snippet) {
        results.push({
          title: title.substring(0, 150),
          url: url,
          snippet: snippet.substring(0, 250)
        });
      }
    });

    return results;
  } catch (error) {
    console.error('DuckDuckGo scraper error:', error.message);
    return [];
  }
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  // Handle OPTIONS requests
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
    const cacheKey = `${query}:${limit}`;
    
    // Check cache
    if (resultCache.has(cacheKey)) {
      const cached = resultCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return res.status(200).json({
          success: true,
          query,
          results: cached.results,
          count: cached.results.length,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
      resultCache.delete(cacheKey);
    }

    // Scrape real results
    const results = await scrapeDuckDuckGo(query, parseInt(limit) || 15);
    
    // Cache results
    resultCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });

    return res.status(200).json({
      success: true,
      query,
      results,
      count: results.length,
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Search API error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      results: [],
      query
    });
  }
};
