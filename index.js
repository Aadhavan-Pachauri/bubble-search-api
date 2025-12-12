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

app.listen(PORT, () => {
  console.log(`Bubble Search API running on port ${PORT}`);
});
