// Unlimited free web search using DuckDuckGo (no API keys, no rate limits)

const axios = require('axios');
const cheerio = require('cheerio');

const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes

async function searchDuckDuckGo(query, limit = 15) {
  const cacheKey = `ddg:${query}:${limit}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache HIT for:', query);
    return cached.results;
  }
  
  try {
    // Use DuckDuckGo's HTML endpoint with a modern user agent
    const response = await axios.get('https://duckduckgo.com/html', {
      params: { q: query, t: 'h_' },
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const $ = cheerio.load(response.data);
    const results = [];
    
    // Parse DuckDuckGo search results
    $('.result').each((i, elem) => {
      if (results.length >= limit) return;
      
      const titleElem = $(elem).find('.result__title a');
      const snippetElem = $(elem).find('.result__snippet');
      const linkElem = $(elem).find('.result__url');
      
      const title = titleElem.text().trim();
      const url = titleElem.attr('href') || '';
      const snippet = snippetElem.text().trim();
      
      if (title && url && url !== '#') {
        results.push({
          title,
          url,
          snippet
        });
      }
    });
    
    // If HTML parsing didn't work, try alternative selectors
    if (results.length === 0) {
      console.log('Using fallback parser for DuckDuckGo results');
      $('[data-result]').each((i, elem) => {
        if (results.length >= limit) return;
        
        const titleElem = $(elem).find('a[data-result-title]');
        const snippetElem = $(elem).find('[data-result-description]');
        
        const title = titleElem.text().trim();
        const url = titleElem.attr('href') || '';
        const snippet = snippetElem.text().trim();
        
        if (title && url) {
          results.push({ title, url, snippet });
        }
      });
    }
    
    // Cache the results
    cache.set(cacheKey, { results, timestamp: Date.now() });
    console.log(`Fetched ${results.length} results for: ${query}`);
    
    return results.slice(0, limit);
  } catch (error) {
    console.error('DuckDuckGo search error:', error.message);
    return [];
  }
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { query, limit = 15 } = req.query;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter is required',
      results: []
    });
  }
  
  try {
    const results = await searchDuckDuckGo(query, Math.min(parseInt(limit) || 15, 15));
    
    return res.status(200).json({
      success: results.length > 0,
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Search failed',
      results: []
    });
  }
};
