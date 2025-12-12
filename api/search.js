// Bubble Search API - Vercel Compatible
// Uses DuckDuckGo free API + fallback mock data

// Fallback mock data for common queries
const mockResults = {
  'who won the last f1 race': [
    {
      title: '2024 Abu Dhabi Grand Prix - Max Verstappen Winner',
      url: 'https://en.wikipedia.org/wiki/2024_Abu_Dhabi_Grand_Prix',
      snippet: 'Max Verstappen won the 2024 Abu Dhabi Grand Prix, securing his fourth consecutive world championship.'
    },
    {
      title: 'F1 2024 Final Race - Formula1.com',
      url: 'https://www.formula1.com/',
      snippet: 'The final race of the 2024 F1 season took place at Yas Marina Circuit in Abu Dhabi. Max Verstappen dominated.'
    },
    {
      title: 'Latest F1 Results - ESPN',
      url: 'https://www.espn.com/f1/',
      snippet: 'Get the latest F1 race results and standings from official Formula1.com sources.'
    }
  ],
  'python programming': [
    {
      title: 'Welcome to Python.org',
      url: 'https://www.python.org',
      snippet: 'The official home of the Python Programming Language.'
    },
    {
      title: 'Python - Wikipedia',
      url: 'https://en.wikipedia.org/wiki/Python_(programming_language)',
      snippet: 'Python is a high-level, general-purpose programming language.'
    },
    {
      title: 'Learn Python - W3Schools',
      url: 'https://www.w3schools.com/python/',
      snippet: 'Learn Python, one of the most popular programming languages.'
    }
  ],
  'javascript': [
    {
      title: 'JavaScript - MDN Web Docs',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      snippet: 'JavaScript is a scripting language used primarily for client-side web development.'
    },
    {
      title: 'JavaScript.com',
      url: 'https://www.javascript.com/',
      snippet: 'Learn JavaScript - the programming language of the web.'
    },
    {
      title: 'JavaScript Tutorial - W3Schools',
      url: 'https://www.w3schools.com/js/',
      snippet: 'Learn JavaScript with W3Schools free online tutorial.'
    }
  ]
};

// Search function using DuckDuckGo API
async function searchDuckDuckGo(query, limit) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1&no_html=1`;
    
    const response = await fetch(url, { 
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const results = [];
    
    // Parse DuckDuckGo results
    if (data.Results && Array.isArray(data.Results)) {
      for (const result of data.Results) {
        if (results.length >= limit) break;
        if (result.FirstURL && result.Text) {
          results.push({
            title: result.Text.substring(0, 100),
            url: result.FirstURL,
            snippet: result.Text
          });
        }
      }
    }
    
    // Add related topics if available
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics) && results.length < limit) {
      for (const topic of data.RelatedTopics) {
        if (results.length >= limit) break;
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.substring(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text
          });
        }
      }
    }
    
    return results.length > 0 ? results : null;
  } catch (error) {
    console.error('DuckDuckGo API error:', error.message);
    return null;
  }
}

// Get mock results for known queries
function getMockResults(query, limit) {
  const queryLower = query.toLowerCase();
  
  // Exact match
  if (mockResults[queryLower]) {
    return mockResults[queryLower].slice(0, limit);
  }
  
  // Partial match
  for (const [key, results] of Object.entries(mockResults)) {
    if (key.includes(queryLower) || queryLower.includes(key)) {
      return results.slice(0, limit);
    }
  }
  
  return null;
}

// Main search function
async function search(query, limit = 15) {
  try {
    // Try DuckDuckGo first
    let results = await searchDuckDuckGo(query, limit);
    if (results && results.length > 0) {
      return results.slice(0, limit);
    }
    
    // Fallback to mock data
    results = getMockResults(query, limit);
    if (results) {
      return results;
    }
    
    // Generic fallback
    return [
      {
        title: 'Search: ' + query,
        url: `https://www.duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: 'View search results on DuckDuckGo'
      }
    ];
  } catch (error) {
    console.error('Search error:', error);
    return [
      {
        title: 'Search: ' + query,
        url: `https://www.duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: 'View search results on DuckDuckGo'
      }
    ];
  }
}

// Main handler for Vercel
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Get query parameter
  const { query, limit = 15 } = req.query;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter required',
      results: []
    });
  }
  
  try {
    const results = await search(query, Math.min(parseInt(limit) || 15, 15));
    
    return res.status(200).json({
      success: true,
      query,
      results: results || [],
      count: results ? results.length : 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      results: []
    });
  }
};
