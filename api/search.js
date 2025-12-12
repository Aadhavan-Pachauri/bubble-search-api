module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  
  const query = req.query.query || '';
  
  res.status(200).json({
    success: true,
    query,
    results: [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Search result for ' + query },
      { title: 'Result 2', url: 'https://example.com/2', snippet: 'Second result' },
      { title: 'Result 3', url: 'https://example.com/3', snippet: 'Third result' }
    ],
    count: 3,
    timestamp: new Date().toISOString()
  });
};
