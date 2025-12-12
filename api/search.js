const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

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
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const parsedUrl = new URL(searchUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    };

    const req_http = client.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const results = parseSearchResults(data, parseInt(limit) || 15);
          return res.status(200).json({
            success: true,
            query,
            results: results || [],
            count: results ? results.length : 0,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          return res.status(500).json({
            success: false,
            error: 'Failed to parse results',
            results: []
          });
        }
      });
    });

    req_http.on('timeout', () => {
      req_http.abort();
      return res.status(500).json({
        success: false,
        error: 'Request timeout',
        results: []
      });
    });

    req_http.on('error', (e) => {
      return res.status(500).json({
        success: false,
        error: 'Network error: ' + e.message,
        results: []
      });
    });

    req_http.end();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Search failed',
      results: []
    });
  }
};

function parseSearchResults(html, limit) {
  const results = [];
  const resultRegex = /<div class="result">(.*?)<\/div>/gs;
  const titleRegex = /<a class="result__a"[^>]*>(.*?)<\/a>/s;
  const urlRegex = /href="([^"]+)"/;
  const snippetRegex = /<a class="result__snippet"[^>]*>(.*?)<\/a>/s;

  let match;
  while ((match = resultRegex.exec(html)) && results.length < limit) {
    try {
      const resultHtml = match[1];
      const titleMatch = titleRegex.exec(resultHtml);
      const urlMatch = urlRegex.exec(resultHtml);
      const snippetMatch = snippetRegex.exec(resultHtml);

      if (titleMatch && urlMatch) {
        let title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
        let url = urlMatch[1].trim();
        let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';

        // Clean up URLs
        if (url.startsWith('/')) {
          url = 'https://duckduckgo.com' + url;
        }

        // Skip tracking/redirect links
        if (title && url && !url.includes('duckduckgo.com/t/') && !url.includes('r.duckduckgo.com') && !url.startsWith('http://duckduckgo') && !url.startsWith('https://duckduckgo/')) {
          results.push({ title, url, snippet });
        }
      }
    } catch (e) {
      // Skip malformed results
      continue;
    }
  }
  return results;
}
