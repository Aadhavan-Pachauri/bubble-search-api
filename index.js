const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

async function searchWeb(query, limit = 15) {
  try {
    const encoded = encodeURIComponent(query);
    const response = await axios.get(`https://www.bing.com/search?q=${encoded}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('li.b_algo').each((i, el) => {
      if (results.length >= limit) return;
      const title = $(el).find('h2 a').text().trim();
      const url = $(el).find('h2 a').attr('href');
      const snippet = $(el).find('.b_caption p').text().trim();
      if (title && url && !url.includes('bing.com')) {
        results.push({ title, url, snippet: snippet || 'No description' });
      }
    });
    return results.slice(0, limit);
  } catch (error) {
    console.error('Bing failed:', error.message);
    return await searchDuckDuckGo(query, limit);
  }
}

async function searchDuckDuckGo(query, limit = 15) {
  try {
    const encoded = encodeURIComponent(query);
    const response = await axios.get(`https://html.duckduckgo.com/?q=${encoded}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('div.web-result').each((i, el) => {
      if (results.length >= limit) return;
      const title = $(el).find('a.result__a').text().trim();
      const url = $(el).find('a.result__a').attr('href');
      const snippet = $(el).find('a.result__snippet').text().trim();
      if (title && url && url.startsWith('http')) {
        results.push({ title, url, snippet: snippet || 'No description' });
      }
    });
    return results.slice(0, limit);
  } catch (error) {
    console.error('DDG failed:', error.message);
    return [];
  }
}

app.get('/', (req, res) => {
  const html = '<!DOCTYPE html><html><head><title>Bubble Search</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto;background:#fff}.container{max-width:800px;margin:0 auto;padding:20px}.header{text-align:center;margin-top:100px;margin-bottom:50px}.logo{font-size:90px;margin-bottom:20px}h1{font-size:32px;color:#333}.search-box{display:flex;max-width:600px;margin:30px auto;box-shadow:0 2px 5px rgba(0,0,0,0.1);border-radius:24px;padding:10px 20px}input{flex:1;border:none;outline:none;font-size:16px;padding:10px}button{background:#4285f4;color:white;border:none;padding:10px 30px;border-radius:4px;cursor:pointer;margin-left:10px}button:hover{background:#357ae8}#results{margin-top:40px}.result{margin-bottom:30px}.result-title{color:#1a0dff;font-size:18px;text-decoration:none}.result-title:hover{text-decoration:underline}.result-url{color:#006621;font-size:14px}.result-snippet{color:#545454;font-size:14px;margin-top:5px}.loading{color:#999}.error{color:#d32f2f;padding:10px;background:#ffebee}</style></head><body><div class="container"><div class="header"><div class="logo">🔍</div><h1>Bubble Search</h1></div><div class="search-box"><input type="text" id="query" placeholder="Search..." onkeypress="if(event.key===\'Enter\')search()"><button onclick="search()">Search</button></div><div id="results"></div></div><script>async function search(){const query=document.getElementById(\'query\').value.trim();if(!query)return;const results=document.getElementById(\'results\');results.innerHTML=\'<div class="loading">Searching...</div>\';try{const resp=await fetch(\'/api/search\',{method:\'POST\',headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({query,limit:15})});const data=await resp.json();if(data.results&&data.results.length>0){results.innerHTML=data.results.map(r=>`<div class="result"><a href="${r.url}" target="_blank" class="result-title">${r.title}</a><div class="result-url">${new URL(r.url).hostname}</div><div class="result-snippet">${r.snippet}</div></div>`).join(\'\')}else{results.innerHTML=\'<div class="error">No results found</div>\'}}catch(e){results.innerHTML=\'<div class="error">Error: \'+e.message+\'</div>\'}}</script></body></html>';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

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
  console.log(`Bubble Search running on port ${PORT}`);
});
