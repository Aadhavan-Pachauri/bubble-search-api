// Bubble Search API - Vercel Compatible
// Ultra-simplified version using mock data only

const mockResults = {
  'who won the last f1 race': [
    {
      title: '2024 Abu Dhabi Grand Prix - Max Verstappen',
      url: 'https://en.wikipedia.org/wiki/2024_Abu_Dhabi_Grand_Prix',
      snippet: 'Max Verstappen won the 2024 Abu Dhabi Grand Prix.'
    },
    {
      title: 'F1 2024 Final Race Results',
      url: 'https://www.formula1.com/',
      snippet: 'The final race of the 2024 F1 season.'
    },
    {
      title: 'F1 Race Results - ESPN',
      url: 'https://www.espn.com/f1/',
      snippet: 'Latest F1 race results and standings.'
    }
  ],
  'python': [
    {
      title: 'Welcome to Python.org',
      url: 'https://www.python.org',
      snippet: 'Official home of the Python Programming Language.'
    },
    {
      title: 'Learn Python - W3Schools',
      url: 'https://www.w3schools.com/python/',
      snippet: 'Learn Python programming language.'
    },
    {
      title: 'Python Tutorial',
      url: 'https://docs.python.org/3/tutorial/',
      snippet: 'Python official tutorial and documentation.'
    }
  ],
  'javascript': [
    {
      title: 'JavaScript - MDN',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      snippet: 'JavaScript language reference and tutorials.'
    },
    {
      title: 'Learn JavaScript',
      url: 'https://www.javascript.com/',
      snippet: 'Learn JavaScript programming.'
    },
    {
      title: 'JavaScript Tutorials - W3Schools',
      url: 'https://www.w3schools.com/js/',
      snippet: 'Free JavaScript tutorials.'
    }
  ]
};

function getMockResults(query, limit) {
  const q = query.toLowerCase();
  
  // Exact match
  if (mockResults[q]) {
    return mockResults[q].slice(0, limit);
  }
  
  // Partial match
  for (const [key, results] of Object.entries(mockResults)) {
    if (q.includes(key) || key.includes(q)) {
      return results.slice(0, limit);
    }
  }
  
  // Fallback
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  
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
    const results = getMockResults(query, Math.min(parseInt(limit) || 15, 15));
    
    if (results) {
      return res.status(200).json({
        success: true,
        query,
        results,
        count: results.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // Fallback for unknown queries
    return res.status(200).json({
      success: true,
      query,
      results: [
        {
          title: 'Search ' + query + ' on DuckDuckGo',
          url: `https://www.duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: 'View search results for your query.'
        }
      ],
      count: 1,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      results: []
    });
  }
};
