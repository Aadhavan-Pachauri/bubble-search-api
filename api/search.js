const axios = require('axios');
const cheerio = require('cheerio');

// Detect query context and add keywords for disambiguation
function enhanceQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  // Auto-detect context from keywords
  if ((lowerQuery.includes('f1') || lowerQuery.includes('formula 1') || lowerQuery.includes('formula one')) && 
      (lowerQuery.includes('won') || lowerQuery.includes('win') || lowerQuery.includes('winner'))) {
    // Add 'race' or 'grand prix' to disambiguate from currency
    if (!lowerQuery.includes('race') && !lowerQuery.includes('grand prix')) {
      return query + ' race';
    }
  }
  return query;
}

// Filter out irrelevant results based on query context
function isRelevantResult(title, snippet, query) {
  const lowerTitle = title.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  const combined = (lowerTitle + ' ' + lowerSnippet).toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Keywords that indicate irrelevant results
  const irrelevantKeywords = ['currency', 'korean won', 'krw', 'exchange rate', 'convert', 'definition', 'meaning', 'buddhism', 'past tense', 'webster'];
  
  // Check if result contains F1/Formula 1 context
  const hasF1Context = combined.includes('f1') || combined.includes('formula') || combined.includes('grand prix') || combined.includes('race') || combined.includes('driver') || combined.includes('motorsport');
  
  // If query explicitly mentions F1/Formula, filter out non-F1 results
  if ((lowerQuery.includes('f1') || lowerQuery.includes('formula')) && !hasF1Context) {
    // Check if it's an irrelevant definition
    for (const keyword of irrelevantKeywords) {
      if (combined.includes(keyword)) {
        return false;
      }
    }
  }
  
  return true;
}

async function searchBing(query, limit = 15) {
  try {
    const enhancedQuery = enhanceQuery(query);
    const encoded = encodeURIComponent(enhancedQuery);
    const response = await axios.get(`https://www.bing.com/search?q=${encoded}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    
    $('li.b_algo').each((i, el) => {
      if (results.length >= limit * 2) return; // Get more initial results to filter
      const title = $(el).find('h2 a').text().trim();
      const url = $(el).find('h2 a').attr('href');
      const snippet = $(el).find('.b_caption p').text().trim();
      
      if (title && url && snippet) {
        // Apply relevance filter
        if (isRelevantResult(title, snippet, query)) {
          results.push({ title, url, snippet });
        }
      }
    });
    
    // Return top results after filtering
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
