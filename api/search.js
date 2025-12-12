const axios = require('axios');
const cheerio = require('cheerio');

async function searchBing(query, limit = 15) {
  try {
    const encoded = encodeURIComponent(query);
    const response = await axios.get(`https://www.bing.com/search?q=${encoded}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    
    $('li.b_algo').each((i, el) => {
      if (results.length >= limit) return;
      const title = $(el).find('h2 a').text().trim();
      const url = $(el).find('h2 a').attr('href');
      const snippet = $(el).find('.b_caption p').text().trim();
      
      if (title && url && snippet) {
        results.push({ title, url, snippet });
      }
    });
    
    return results.slice(0, limit);
  } catch (error) {
    console.error('Bing search failed:', error.message);
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
    const results = await searchBing(query.trim(), Math.min(parseInt(limit) || 10, 15));
    return res.json({ success: true, query: query.trim(), results });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
};
