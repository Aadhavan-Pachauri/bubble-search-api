// SearXNG - Free, unlimited web search (no API keys required)
// Uses public SearXNG instances that aggregate results from Google, Bing, DuckDuckGo, etc.

const axios = require('axios');

// Simple in-memory cache (5 min TTL)
const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes

// List of reliable public SearXNG instances
const SEARXNG_INSTANCES = [
  'https://searx.space/',
  'https://search.mydataknows.com/',
  'https://searx.info/',
  'https://search.privacyguide.org/',
];

// Get a working SearXNG instance (with fallback)
let currentInstanceIndex = 0;

async function getWorkingSearXNGInstance() {
  const maxAttempts = SEARXNG_INSTANCES.length;
  
  for (let i = 0; i < maxAttempts; i++) {
    const instance = SEARXNG_INSTANCES[currentInstanceIndex % SEARXNG_INSTANCES.length];
    currentInstanceIndex++;
    
    try {
      // Test the instance
      const response = await axios.get(`${instance}api`, { timeout: 3000 });
      if (response.status === 200) {
        return instance;
      }
    } catch (error) {
      console.log(`Instance ${instance} unavailable, trying next...`);
    }
  }
  
  // Default to first instance if all fail
  return SEARXNG_INSTANCES[0];
}

async function searchSearXNG(query, limit = 15) {
  const cacheKey = `searxng:${query}:${limit}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache HIT for:', query);
    return cached.results;
  }
  
  try {
    const instance = await getWorkingSearXNGInstance();
    console.log(`Searching with SearXNG instance: ${instance}`);
    
    const response = await axios.get(`${instance}api`, {
      params: {
        q: query,
        format: 'json',
        pageno: 1,
        safesearch: 0,
        time_range: 'year',
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const results = (response.data.results || []).slice(0, limit).map(result => ({
      title: result.title || '',
      url: result.url || '',
      snippet: result.content || result.summary || ''
    }));
    
    // Cache the results
    cache.set(cacheKey, { results, timestamp: Date.now() });
    console.log(`Cache MISS - fetched ${results.length} results for: ${query}`);
    
    return results;
  } catch (error) {
    console.error('SearXNG Search error:', error.message);
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
    const results = await searchSearXNG(query, Math.min(parseInt(limit) || 15, 15));
    
    return res.status(200).json({
      success: true,
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
