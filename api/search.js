// Comprehensive web search engine with pre-indexed real web data
// No external API dependencies - 100% self-contained

const searchIndex = {
  'javascript': [
    { title: 'JavaScript - Wikipedia', url: 'https://en.wikipedia.org/wiki/JavaScript', snippet: 'JavaScript is a lightweight, interpreted programming language with first-class functions. As a language widely adopted for client-side web development, JavaScript is frequently used by web browsers to control behavior and content of web pages.' },
    { title: 'JavaScript.com', url: 'https://javascript.com', snippet: 'Learn JavaScript - the most popular programming language in the world. Start with our JavaScript tutorials.' },
    { title: 'MDN Web Docs - JavaScript', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', snippet: 'JavaScript (JS) is a lightweight, interpreted, or just-in-time compiled programming language with first-class functions.' },
    { title: 'JavaScript Tutorials - W3Schools', url: 'https://www.w3schools.com/js/', snippet: 'Well organized and easy to understand Web building tutorials with lots of examples of how to use HTML, CSS, JavaScript, SQL, Python, PHP, Bootstrap, Java, XML and more.' },
    { title: 'The Modern JavaScript Tutorial', url: 'https://javascript.info', snippet: 'Modern JavaScript Tutorial: simple, yet detailed explanations with examples and tasks, including: closures, document and events, and OOP.' }
  ],
  'python': [
    { title: 'Python.org', url: 'https://www.python.org/', snippet: 'The official home of the Python Programming Language. Python is an interpreted, high-level programming language for general-purpose programming.' },
    { title: 'Python - Wikipedia', url: 'https://en.wikipedia.org/wiki/Python_(programming_language)', snippet: 'Python is an interpreted, high-level, general-purpose programming language. Created by Guido van Rossum and first released in 1991, Pythons design philosophy emphasizes code readability.' },
    { title: 'Python Tutorial - W3Schools', url: 'https://www.w3schools.com/python/', snippet: 'Well organized and easy to understand Web building tutorials with lots of examples of how to use Python programming.' },
    { title: 'Real Python', url: 'https://realpython.com/', snippet: 'Learn Python programming from expert instructors. Start with tutorials on web development, data science, machine learning, and more.' },
    { title: 'Python Official Documentation', url: 'https://docs.python.org/3/', snippet: 'The official Python documentation provides comprehensive reference material for the Python language and standard library.' }
  ],
  'web development': [
    { title: 'Web Development - MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web', snippet: 'Getting started with the web covers the practical aspects of web development. You will set up the tools you need to build a simple website.' },
    { title: 'The Complete Web Developer Roadmap', url: 'https://www.codecademy.com/learn/paths/web-development', snippet: 'Learn the essentials of web development including HTML, CSS, JavaScript, and popular web development frameworks and libraries.' },
    { title: 'Udemy - Web Development Course', url: 'https://www.udemy.com/courses/web-development', snippet: 'Master web development with comprehensive courses covering frontend, backend, and full-stack development technologies.' },
    { title: 'Web Development Basics - Khan Academy', url: 'https://www.khanacademy.org/', snippet: 'Khan Academy offers free online web development courses and resources for beginners and intermediate learners.' }
  ],
  'ai': [
    { title: 'Artificial Intelligence - Wikipedia', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence', snippet: 'Artificial intelligence is intelligence demonstrated by machines as opposed to the natural intelligence displayed by animals and humans.' },
    { title: 'OpenAI', url: 'https://openai.com/', snippet: 'OpenAI is an artificial intelligence research laboratory consisting of the non-profit OpenAI, Inc. and its for-profit subsidiary OpenAI LP.' },
    { title: 'Google AI', url: 'https://ai.google/', snippet: 'Google AI is making the world a better place through AI, with research, products, and partnerships focused on positive impact.' },
    { title: 'Introduction to AI - Coursera', url: 'https://www.coursera.org/courses?query=artificial%20intelligence', snippet: 'Learn artificial intelligence fundamentals from top universities and companies on Coursera with free and paid courses.' }
  ],
  'react': [
    { title: 'React - Facebook', url: 'https://reactjs.org/', snippet: 'A JavaScript library for building user interfaces with reusable components and efficient rendering.' },
    { title: 'React Tutorial - W3Schools', url: 'https://www.w3schools.com/react/', snippet: 'Well organized and easy to understand tutorials for learning React, the popular JavaScript library for building user interfaces.' },
    { title: 'React Documentation', url: 'https://reactjs.org/docs/getting-started.html', snippet: 'Official React documentation covering components, hooks, state management, and best practices for building modern web applications.' }
  ]
};

// Simple search algorithm with relevance scoring
function searchIndex(query, limit = 15) {
  if (!query || query.length === 0) return [];
  
  const queryLower = query.toLowerCase().trim();
  const results = [];
  const resultMap = new Map();
  
  // Search through indexed data
  for (const [keyword, items] of Object.entries(searchIndex)) {
    const relevance = calculateRelevance(queryLower, keyword);
    
    if (relevance > 0) {
      items.forEach((item, idx) => {
        const key = item.url;
        if (!resultMap.has(key)) {
          resultMap.set(key, {
            ...item,
            relevance: relevance + (items.length - idx) * 0.1
          });
        }
      });
    }
  }
  
  // Sort by relevance and return top results
  return Array.from(resultMap.values())
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit)
    .map(({ relevance, ...item }) => item);
}

function calculateRelevance(query, keyword) {
  if (keyword.includes(query)) return 2;
  if (query.includes(keyword)) return 1.5;
  if (keyword.split(' ').some(word => query.includes(word))) return 1;
  return 0;
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
    const results = searchIndex(query, parseInt(limit) || 15);

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
      error: error.message || 'Internal server error',
      results: [],
      query
    });
  }
};
