const https = require('https');
const http = require('http');
const { URL } = require('url');

// Real DuckDuckGo HTML scraper without external dependencies
function scrapeDuckDuckGo(query, limit = 15) {
  return new Promise((resolve) => {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const parsedUrl = new URL(searchUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 8000
      };

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const results = parseSearchResults(data, limit);
            resolve(results || []);
          } catch (e) {
            resolve([]);
          }
        });
      });

      req.on('timeout', () => {
        req.abort();
        resolve([]);
      });
      req.on('error', () => resolve([]));
      req.end();
    } catch (e) {
      resolve([]);
    }
  });
}

function parseSearchResults(html, limit) {
  const results = [];
  const resultRegex = /<div class="result">(.*?)<\/div>/gs;
  const titleRegex = /<a class="result__a"[^>]*href="[^"]*"[^>]*>(.*?)<\/a>/s;
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

        // Skip redirect links and invalid results
        if (url.startsWith('/')) {
          url = 'https://duckduckgo.com' + url;
        }

        if (title && url && !url.includes('duckduckgo.com/t/') && !url.includes('r.duckduckgo.com')) {
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

module.exports = async (req, res) => {
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
    const maxLimit = Math.min(parseInt(limit) || 15, 15);
    const results = await scrapeDuckDuckGo(query, maxLimit);

    return res.status(200).json({
      success: true,
      query,
      results: results || [],
      count: results ? results.length : 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Search failed',
      results: []
    });
  }
};
