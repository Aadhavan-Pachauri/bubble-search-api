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

// Filter out only the MOST obviously irrelevant results
function shouldExcludeResult(title, snippet, query) {
  const lowerTitle = title.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  const combined = (lowerTitle + ' ' + lowerSnippet).toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Only exclude if it's CLEARLY about the wrong "won" - currency/definition/religion
  const strongIndicators = {
    currency: ['korean won', 'krw', 'exchange rate', 'convert.*won', 'won to dollar'],
    definition: ['definition.*won', 'meaning.*won', 'webster', 'merriam', 'past tense of win'],
    religion: ['won buddhism', 'buddhist']
  };
  
  // Check for strong indicators of wrong context
  for (const [category, patterns] of Object.entries(strongIndicators)) {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(combined)) {
        return true; // Exclude this result
      }
    }
  }
  
  // For F1 queries, give preference to results mentioning racing/sports
  if ((lowerQuery.includes('f1') || lowerQuery.includes('formula')) &&
      (combined.includes('sport') || combined.includes('race') || combined.includes('grand prix') || 
       combined.includes('driver') || combined.includes('motorsport') || combined.includes('lewis') ||
       combined.includes('verstappen') || combined.includes('alonso') || combined.includes('hamilton'))) {
    return false; // Keep this - it's likely about F1
  }
  
  // Don't exclude generic news about winners/races
  return false;
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
    const allResults = []; // Track all results for scoring
    
    $('li.b_algo').each((i, el) => {
      if (allResults.length >= limit * 3) return; // Get more initial results
      const title = $(el).find('h2 a').text().trim();
      const url = $(el).find('h2 a').attr('href');
      const snippet = $(el).find('.b_caption p').text().trim();
      
      if (title && url && snippet) {
        allResults.push({ title, url, snippet, index: i });
      }
    });
    
    // Sort: first exclude obviously wrong results, then prefer query-relevant ones
    allResults.forEach(result => {
      if (!shouldExcludeResult(result.title, result.snippet, query)) {
        results.push(result);
      }
    });
    
    // Return top results after filtering
    return results.slice(0, limit).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet
    }));
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
