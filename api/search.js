// Brave Search - Free, 2000 queries/month
// Sign up: https://api.search.brave.com/
// Much better than DuckDuckGo HTML endpoint

const https = require('https');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { query, limit = 15 } = req.query;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter required',
      results: []
    });
  }

  // Get API key from environment
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  // If no API key, provide setup instructions
  if (!apiKey) {
    return res.status(200).json({
      success: false,
      query,
      results: [],
      message: 'Setup required',
      setupInstructions: {
        step1: 'Sign up for free at https://api.search.brave.com/',
        step2: 'Copy your API key from dashboard',
        step3: 'Add to Vercel env: BRAVE_SEARCH_API_KEY=your_key',
        step4: 'Redeploy and search will work with real results!',
        freeQuota: '2000 queries per month - unlimited for development'
      },
      timestamp: new Date().toISOString()
    });
  }

  const count = Math.min(parseInt(limit) || 15, 20);
  const path = `/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;

  const options = {
    hostname: 'api.search.brave.com',
    path,
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey
    },
    timeout: 8000
  };

  const req_api = https.request(options, (response) => {
    let data = '';
    response.on('data', chunk => { data += chunk; });
    response.on('end', () => {
      try {
        const result = JSON.parse(data);
        
        if (response.statusCode === 200 && result.web) {
          const results = result.web.slice(0, count).map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.description || ''
          }));
          
          return res.status(200).json({
            success: true,
            query,
            results,
            count: results.length,
            source: 'brave_search',
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        // Handle parse error
      }
      
      return res.status(200).json({
        success: false,
        query,
        results: [],
        error: 'API error or invalid key',
        timestamp: new Date().toISOString()
      });
    });
  });

  req_api.on('timeout', () => {
    req_api.abort();
    res.status(500).json({ success: false, error: 'Request timeout' });
  });

  req_api.on('error', (e) => {
    res.status(500).json({ success: false, error: e.message });
  });

  req_api.end();
};
