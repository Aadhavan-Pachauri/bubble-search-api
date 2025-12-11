import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

async function searchGoogle(query, limit = 10) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await axios.get(`https://www.google.com/search?q=${encodedQuery}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $('div.g').each((i, element) => {
      if (i >= limit) return false;
      const titleElement = $(element).find('h3');
      const linkElement = $(element).find('a');
      const snippetElement = $(element).find('.VwiC3b');
      if (titleElement.length && linkElement.length) {
        const url = linkElement.attr('href');
        if (url && url.startsWith('http')) {
          results.push({
            title: titleElement.text().trim(),
            url: url,
            snippet: snippetElement.text().trim() || ''
          });
        }
      }
    });
    return results;
  } catch (error) {
    console.error('Search error:', error.message);
    return [];
  }
}

app.post('/api/search', async (req, res) => {
  const { query, limit = 10 } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query' });
  }
  try {
    const results = await searchGoogle(query.trim(), Math.min(parseInt(limit) || 10, 15));
    return res.json({ success: true, query: query.trim(), results });
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
