import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Custom search that hits Bing's HTML search (no auth needed, works reliably)
async function searchWeb(query, limit = 15) {
  try {
    // Use Bing search HTML endpoint with proper headers to avoid blocking
    const encoded = encodeURIComponent(query);
    const response = await axios.get(
      `https://www.bing.com/search?q=${encoded}`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      }
    );

    const $ = cheerio.load(response.data);
    const results = [];

    // Parse Bing search results
    $('li.b_algo').each((i, el) => {
      if (results.length >= limit) return;

      const titleEl = $(el).find('h2 a');
      const descEl = $(el).find('.b_caption p');
      const urlEl = $(el).find('h2 a').attr('href');

      const title = titleEl.text().trim();
      const url = urlEl;
      const snippet = descEl.text().trim();

      if (title && url && !url.includes('bing.com')) {
        results.push({
          title,
          url,
          snippet: snippet || 'No description available'
        });
      }
    });

    return results.slice(0, limit);
  } catch (error) {
    console.error('Search error:', error.message);
    // Fallback: try DuckDuckGo HTML search
    return await searchDuckDuckGo(query, limit);
  }
}

// Fallback DuckDuckGo search
async function searchDuckDuckGo(query, limit = 15) {
  try {
    const encoded = encodeURIComponent(query);
    const response = await axios.get(
      `https://html.duckduckgo.com/?q=${encoded}`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml'
        }
      }
    );

    const $ = cheerio.load(response.data);
    const results = [];

    $('div.web-result').each((i, el) => {
      if (results.length >= limit) return;

      const titleEl = $(el).find('a.result__a');
      const snippetEl = $(el).find('a.result__snippet');
      const url = titleEl.attr('href');
      const title = titleEl.text().trim();
      const snippet = snippetEl.text().trim();

      if (title && url && url.startsWith('http')) {
        results.push({
          title,
          url,
          snippet: snippet || 'No description available'
        });
      }
    });

    return results.slice(0, limit);
  } catch (error) {
    console.error('DuckDuckGo fallback error:', error.message);
    return [];
  }
}

app.post('/api/search', async (req, res) => {
  const { query, limit = 10 } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query' });
  }

  try {
    const results = await searchWeb(
      query.trim(),
      Math.min(parseInt(limit) || 10, 15)
    );
    return res.json({
      success: true,
      query: query.trim(),
      results
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bubble Search</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #fff; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-top: 100px; margin-bottom: 50px; }
        .logo { font-size: 90px; font-weight: 300; color: #4285f4; margin-bottom: 30px; letter-spacing: -3px; }
        .search-box { display: flex; max-width: 600px; margin: 30px auto; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border-radius: 24px; padding: 10px 20px; }
        input { flex: 1; border: none; outline: none; font-size: 16px; padding: 10px; }
        button { background: #4285f4; color: white; border: none; padding: 10px 30px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-left: 10px; }
        button:hover { background: #357ae8; }
        #results { margin-top: 40px; }
        .result { margin-bottom: 30px; }
        .result-title { color: #1a0dff; font-size: 18px; text-decoration: none; cursor: pointer; }
        .result-title:hover { text-decoration: underline; }
        .result-url { color: #006621; font-size: 14px; }
        .result-snippet { color: #545454; font-size: 14px; margin-top: 5px; line-height: 1.6; }
        .loading { text-align: center; color: #999; font-size: 14px; }
        .error { color: #d32f2f; padding: 10px; background: #ffebee; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🔍</div>
          <h1>Bubble Search</h1>
        </div>
        <div class="search-box">
          <input type="text" id="query" placeholder="Search the web..." onkeypress="if(event.key==='Enter')search()">
          <button onclick="search()">Search</button>
        </div>
        <div id="results"></div>
      </div>
      <script>
        async function search() {
          const query = document.getElementById('query').value.trim();
          if (!query) return;
          
          const resultsDiv = document.getElementById('results');
          resultsDiv.innerHTML = '<div class="loading">Searching...</div>';
          
          try {
            const response = await fetch('/api/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, limit: 15 })
            });
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
              resultsDiv.innerHTML = data.results.map(r => `
                <div class="result">
                  <a href="${r.url}" target="_blank" class="result-title">${r.title}</a>
                  <div class="result-url">${new URL(r.url).hostname}</div>
                  <div class="result-snippet">${r.snippet}</div>
                </div>
              `).join('');
            } else {
              resultsDiv.innerHTML = '<div class="error">No results found</div>';
            }
          } catch (error) {
            resultsDiv.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
          }
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Bubble Search API running on port ${PORT}`);
});
