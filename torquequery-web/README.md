# TorqueQuery Web UI

Real-time, minimal web interface for hybrid code search.

## Quick Start

```bash
cd torquequery-web
npm install
npm run dev
```

Open `http://localhost:5052` in your browser.

## Configuration

Environment variables:

```bash
PORT=5052
HYBRID_API_URL=http://localhost:5051
```

## Features

- **Real-time search** — results stream as you type (300ms debounce)
- **Search indicators**:
  - 📝 Keyword search (structure/symbols/imports)
  - 🧠 Semantic search (meaning/logic)
  - 🔄 Hybrid (both matched)
- **Score display** — 0.000 to 1.000
- **Click to copy** — click any result to copy path to clipboard
- **Top 50 results** — limited for fast UI response

## API

Web UI calls `/api/search` on the backend:

```bash
GET /api/search?q=WarmPoolManager
```

Response:

```json
{
  "query": "WarmPoolManager",
  "count": 3,
  "results": [
    {
      "path": "src/agents/WarmPoolManager.ts",
      "repo": "castironforge",
      "hybridScore": 0.892,
      "keywordScore": 0.95,
      "vectorScore": 0.42
    }
  ]
}
```

## Performance

- ~50ms per search (hybrid endpoint)
- ~10ms UI render
- Debounced input (300ms)

## Browser Support

Modern browsers with ES2020+ support.

## License

Part of CIC system.
