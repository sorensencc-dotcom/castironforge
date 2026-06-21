# ts-find

Terminal CLI for fast, deterministic code search. Replaces grep. Queries Typesense via Search API.

## Quick Start

```bash
cd ts-find
npm install
npm run build
```

Then use globally:

```bash
ts-find WarmPoolManager
ts-find --symbols hydrate
ts-find --repo cic --phase 27 spawn
```

Or run locally:

```bash
npm run dev -- WarmPoolManager
```

## Configuration

Environment variable:

```bash
SEARCH_API_URL=http://localhost:5050
```

Defaults to `http://localhost:5050` if not set.

## Usage

```
Usage: ts-find [OPTIONS] QUERY

Options:
  --repo REPO              Filter by repo
  --language LANG          Filter by language
  --phase NUM              Filter by CIC phase
  --adapter NAME           Filter by adapter
  --symbols                Search only in symbols
  --functions              Search only in functions
  --imports                Search only in imports
  --exports                Search only in exports
  --todos                  Search only in TODOs
  --per-page NUM           Results per page (default: 20)

Examples:
  ts-find WarmPoolManager
  ts-find --symbols hydrate
  ts-find --repo cic --phase 27 spawn
  ts-find --imports puppeteer
  ts-find --todos
  ts-find --adapter WarmPoolManager --repo cic
```

## Examples

### Keyword search (content + symbols + imports)

```bash
ts-find hydrate
```

Output:

```
🔍 Found 3 result(s) for "hydrate"

📄 src/agents/WarmPoolManager.ts
   lang: ts
   repo: castironforge
   phase: 27
   adapter: WarmPoolManager
   symbols: WarmPoolManager, hydrate, spawn
   functions: hydrate, spawn

...
```

### Symbol search

```bash
ts-find --symbols WarmPoolManager
```

### Function search

```bash
ts-find --functions spawn
```

### Faceted search (repo + phase)

```bash
ts-find --repo cic --phase 27 hydrate
```

### Import search

```bash
ts-find --imports puppeteer
```

### Export search

```bash
ts-find --exports default
```

### TODO search

```bash
ts-find --todos refactor
```

### Adapter search

```bash
ts-find --adapter WarmPoolManager spawn
```

### Limit results

```bash
ts-find --per-page 5 WarmPoolManager
```

## Performance

- ~50ms per query (Search API + network)
- Terminal output: ~10ms
- No disk I/O (pure network search)

## Integration

Works with:

- **Shell scripts** — pipe output to `head`, `awk`, etc.
- **VS Code** — as a terminal search
- **Chat agent** — can call this CLI or call Search API directly

## Exit codes

- `0` — success
- `1` — error (query parse, API error, etc.)

## Comparison to grep

| Task | grep | ts-find |
|------|------|---------|
| Keyword search | `grep -r "hydrate"` | `ts-find hydrate` |
| Symbol search | `grep -r "function hydrate"` | `ts-find --symbols hydrate` |
| Faceted filter | Hard (multiple greps) | `ts-find --phase 27 --repo cic hydrate` |
| Performance | Slow (disk I/O) | Fast (in-memory Typesense) |
| Code-aware | No (regex only) | Yes (AST parsing) |

## License

Part of CIC system.
