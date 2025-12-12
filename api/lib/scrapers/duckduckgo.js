const axios = require('axios');
const cheerio = require('cheerio');

// Real DuckDuckGo scraper
async function scrapeDuckDuckGo(query, limit = 15) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/?q=${encodedQuery}`;

    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const results = [];

    $('.result').each((index, element) => {
      if (results.length >= limit) return;
      
      const titleElem = $(element).find('.result__title');
      const snippetElem = $(element).find('.result__snippet');
      
      const title = titleElem.text().trim();
      const url = titleElem.find('a').attr('href');
      const snippet = snippetElem.text().trim();

      if (title && url && snippet) {
        results.push({
          title: title.substring(0, 100),
          url: url,
          snippet: snippet.substring(0, 200)
        });
      }
    });

    return results;
  } catch (error) {
    console.error('Scraper error:', error.message);
    return [];
  }
}

module.exports = { scrapeDuckDuckGo };
