import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Simple working search using Jina Reader API
async function searchWeb(query, limit = 15) {
  try {
    // Use Jina's search endpoint at s.jina.ai
    const response = await axios.get(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const text = response.data || '';
    const results = [];

    // Parse the response (Jina returns markdown-formatted text)
    const lines = text.split('\n');
    let currentResult = null;

    for (const line of lines) {
      if (line.startsWith('##')) {
        if (currentResult && currentResult.title && currentResult.url) {
          results.push(currentResult);
        }
        currentResult = { title: line.replace(/##\s*/g, '').trim(), url: '', snippet: '' };
      } else if (line.includes('http') && currentResult && !currentResult.url) {
        const urlMatch = line.match(/(https?:\/\/[^\s)]+)/);        if (urlMatch) {
          currentResult.url = urlMatch[1];
        }
      } else if (currentResult && !currentResult.snippet && line.trim()) {
        currentResult.snippet = line.trim();
      }

      if (results.length >= limit) break;
    }

    if (currentResult && currentResult.title && currentResult.url && results.length < limit) {
      results.push(currentResult);
    }

    return results.slice(0, limit);
  } catch (error) {
    console.error('Search error:', error.message);
    return [];
  }
}

app.post('/api/search', async (req, res) => {
  const { query, limit = 10 } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query' });
  }

  try {
    const results = await searchWeb(query.trim(), Math.min(parseInt(limit) || 10, 15));
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
