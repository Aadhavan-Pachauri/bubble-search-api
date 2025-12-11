# Bubble Search API

Free web search API for Bubble AI - searches the web and returns clean JSON results without API keys.

## Features

- Free web search (no API keys required)
- Fast search results in JSON format
- Up to 15 results per search
- Easy to integrate with Bubble AI
- Deployed on Vercel (serverless)

## API Endpoint

```
POST /api/search
```

## Request

```json
{
  "query": "last F1 race winner",
  "limit": 10
}
```

## Response

```json
{
  "success": true,
  "query": "last F1 race winner",
  "results": [
    {
      "title": "Page Title",
      "url": "https://example.com",
      "snippet": "Description of the page..."
    }
  ]
}
```

## Usage in Bubble AI

```typescript
async function runBubbleSearch(query: string, limit = 15) {
  try {
    const resp = await fetch("https://bubble-search-api.vercel.app/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
}
```

## Installation

1. Clone the repo
2. `npm install`
3. `npm start`

## Deployment

Deploy to Vercel with one click.

## License

MIT
