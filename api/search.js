const axios = require('axios');

// Simple in-memory cache (consider using Redis for production)
const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes

// Brave Search API - Free, unlimited for non-commercial use
async function searchBrave(query, limit = 15) {
  const cacheKey = `brave:${query}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache HIT for:', query);
    return cached.results;
  }

  try {
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      params: { q: query, count: Math.min(limit, 20) },
      headers: { 'Accept': 'application/json' },
      timeout: 10000,
    });

    const results = (response.data.web || []).map(result => ({
      title: result.title,
      url: result.url,
      snippet: result.description || '',
    })).slice(0, limit);

    // Cache the results
    cache.set(cacheKey, { results, timestamp: Date.now() });
    console.log('Cache MISS - fetched from Brave for:', query);
    return results;
  } catch (error) {
    console.error('Brave Search error:', error.message);
    if (error.response?.status === 401) {
      console.error('Brave API key missing or invalid. Using fallback...');
    }
    return [];
  }
}

// Fallback: Google Custom Search (requires setup but is very reliable)
async function searchGoogle(query, limit = 15) {
  try {
    // This requires setting up Google Custom Search Engine
    // For now, return empty to demonstrate fallback structure
    console.log('Google Search - not configured (optional fallback)');
    return [];
  } catch (error) {
    console.error('Google Search error:', error.message);
    return [];
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { query, limit = 10 } = req.method === 'POST' ? req.body : req.query;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query parameter' });
  }
  
  try {
    const results = await searchBrave(query.trim(), Math.min(parseInt(limit) || 10, 20));
    return res.json({
      success: results.length > 0,
      query: query.trim(),
      results,
      count: results.length,
      source: 'brave-search-api',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
};
