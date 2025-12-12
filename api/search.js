// Unlimited web search API using google-it library
// Completely free, no API keys required

const googleIt = require('google-it');

const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes

async function searchGoogle(query, limit = 15) {
  const cacheKey = `google:${query}:${limit}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache HIT for:', query);
    return cached.results;
  }
  
  try {
    const results = await googleIt({ query, limit: Math.min(limit, 20) });
    
    const formattedResults = results.slice(0, limit).map(item => ({
      title: item.title || '',
      url: item.link || '',
      snippet: item.snippet || ''
    }));
    
    // Cache the results
    cache.set(cacheKey, { results: formattedResults, timestamp: Date.now() });
    console.log(`Fetched ${formattedResults.length} results for: ${query}`);
    
    return formattedResults;
  } catch (error) {
    console.error('Google search error:', error.message);
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
    const results = await searchGoogle(query, Math.min(parseInt(limit) || 15, 15));
    
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
