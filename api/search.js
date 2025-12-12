// Free unlimited web search using DuckDuckGo and fallback sources
// No API keys required - uses public endpoints

const axios = require('axios');

const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes

// Try multiple search endpoints
async function searchMultiple(query, limit = 15) {
  const cacheKey = `search:${query}:${limit}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache HIT for:', query);
    return cached.results;
  }
  
  try {
    // Try DuckDuckGo Instant Answer API first
    const results = await tryDuckDuckGo(query, limit);
    if (results.length > 0) {
      cache.set(cacheKey, { results, timestamp: Date.now() });
      return results;
    }
    
    // Fallback to Google-it (must be installed)
    return await tryGoogleIt(query, limit);
  } catch (error) {
    console.error('Search error:', error.message);
    return [];
  }
}

// DuckDuckGo search with result expansion
async function tryDuckDuckGo(query, limit = 15) {
  try {
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: 'json',
        no_redirect: 1,
        d: 1
      },
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const results = [];
    
    // Parse DuckDuckGo results
    const data = response.data;
    
    // Add instant answer if available
    if (data.AbstractText) {
      results.push({
        title: data.Heading || 'Answer',
        url: data.AbstractURL || '',
        snippet: data.AbstractText
      });
    }
    
    // Add related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics) {
        if (results.length >= limit) break;
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.substring(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text
          });
        }
      }
    }
    
    console.log(`DuckDuckGo returned ${results.length} results for: ${query}`);
    return results.slice(0, limit);
  } catch (error) {
    console.error('DuckDuckGo search failed:', error.message);
    return [];
  }
}

// Google-it fallback
async function tryGoogleIt(query, limit = 15) {
  try {
    const googleIt = require('google-it');
    const results = await googleIt({ query, limit: Math.min(limit, 20) });
    
    return results.slice(0, limit).map(item => ({
      title: item.title || '',
      url: item.link || '',
      snippet: item.snippet || ''
    }));
  } catch (error) {
    console.error('google-it failed:', error.message);
    return [];
  }
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  
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
    const results = await searchMultiple(query, Math.min(parseInt(limit) || 15, 15));
    
    return res.status(200).json({
      success: results.length > 0,
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Search failed: ' + error.message,
      results: []
    });
  }
};
