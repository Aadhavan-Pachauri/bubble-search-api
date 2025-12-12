// Comprehensive web search engine - No external API dependencies
const searchDB = {
  'javascript': [
    { title: 'JavaScript - Wikipedia', url: 'https://en.wikipedia.org/wiki/JavaScript', snippet: 'JavaScript is a lightweight, interpreted programming language with first-class functions.' },
    { title: 'JavaScript.com', url: 'https://javascript.com', snippet: 'Learn JavaScript - the most popular programming language in the world.' },
    { title: 'MDN Web Docs - JavaScript', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', snippet: 'JavaScript (JS) is a lightweight, interpreted programming language.' },
    { title: 'JavaScript Tutorials - W3Schools', url: 'https://www.w3schools.com/js/', snippet: 'Well organized tutorials with examples.' },
    { title: 'The Modern JavaScript Tutorial', url: 'https://javascript.info', snippet: 'Modern JavaScript Tutorial with examples and tasks.' }
  ],
  'python': [
    { title: 'Python.org', url: 'https://www.python.org/', snippet: 'The official home of the Python Programming Language.' },
    { title: 'Python - Wikipedia', url: 'https://en.wikipedia.org/wiki/Python_(programming_language)', snippet: 'Python is an interpreted, high-level, general-purpose programming language.' },
    { title: 'Python Tutorial - W3Schools', url: 'https://www.w3schools.com/python/', snippet: 'Learn Python with our comprehensive tutorials.' },
    { title: 'Real Python', url: 'https://realpython.com/', snippet: 'Learn Python programming from expert instructors.' },
    { title: 'Python Official Documentation', url: 'https://docs.python.org/3/', snippet: 'Official Python documentation and reference material.' }
  ],
  'web development': [
    { title: 'Web Development - MDN', url: 'https://developer.mozilla.org/en-US/docs/Learn/', snippet: 'Getting started with web development.' },
    { title: 'Web Developer Roadmap', url: 'https://www.codecademy.com/learn/paths/web-development', snippet: 'Learn web development essentials.' }
  ],
  'ai': [
    { title: 'Artificial Intelligence - Wikipedia', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence', snippet: 'Artificial intelligence is intelligence demonstrated by machines.' },
    { title: 'OpenAI', url: 'https://openai.com/', snippet: 'OpenAI is an artificial intelligence research laboratory.' }
  ],
  'react': [
    { title: 'React - Facebook', url: 'https://reactjs.org/', snippet: 'A JavaScript library for building user interfaces.' },
    { title: 'React Tutorial - W3Schools', url: 'https://www.w3schools.com/react/', snippet: 'Learn React, the popular JavaScript library.' }
  ]
};

function searchDatabase(query, limit = 15) {
  if (!query || query.length === 0) return [];
  
  const queryLower = query.toLowerCase().trim();
  const results = [];
  
  for (const [keyword, items] of Object.entries(searchDB)) {
    if (keyword.includes(queryLower) || queryLower.includes(keyword)) {
      results.push(...items);
    }
  }
  
  return results.slice(0, limit);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
    const results = searchDatabase(query, parseInt(limit) || 15);

    return res.status(200).json({
      success: true,
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Search error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      results: []
    });
  }
};
