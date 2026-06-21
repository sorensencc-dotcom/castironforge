# TorqueQuery CLI

Fast terminal interface for hybrid code search (keyword + semantic).

## Quick Start

```bash
cd torquequery-cli
npm install
npm run build
```

Then run:

```bash
tq WarmPoolManager
tq "Phase 27 adapter"
tq "how does hydration work"
```

## Configuration

Environment variable:

```bash
TORQUEQUERY_API_URL=http://localhost:5051
```

Defaults to `http://localhost:5051` if not set.

## Usage

```bash
tq QUERY
```

## Examples

### Keyword search (code structure)

```bash
tq WarmPoolManager
```

Output:

```
🔍 TorqueQuery Hybrid Search: "WarmPoolManager"
--------------------------------------------------
  📝 0.892  src/agents/WarmPoolManager.ts        (castironforge)
  📝 0.745  src/pool/WarmPool.ts                 (castironforge)
  🧠 0.654  src/adapters/adapter.ts              (castironforge)

Total: 3 result(s) | Strategy: keyword (📝) | semantic (🧠) | hybrid (🔄)
```

### Semantic search (logic/behavior)

```bash
tq "how does hydration work"
```

Uses vector similarity to find semantically related code.

### Hybrid search (best of both)

```bash
tq "spawn browser"
```

Combines keyword + semantic scores for balanced results.

## Output Format

Each result shows:

- **Strategy indicator**:
  - `📝` — keyword search (structure/symbols/imports)
  - `🧠` — semantic search (meaning/logic)
  - `🔄` — hybrid (both keyword and semantic matched)

- **Score**: `0.000` to `1.000` (higher is better)

- **Path**: File path

- **Repo**: Repository name

## Performance

- ~100ms per query (Typesense + Qdrant fan-out + scoring)
- Results limited to top 20 by default

## Integration with Other Tools

### With pipe (get just paths)

```bash
tq WarmPoolManager | grep -oE "src/.*\.ts"
```

### With fzf (fuzzy pick)

```bash
tq WarmPoolManager | fzf | cut -d' ' -f3
```

### In scripts

```bash
#!/bin/bash
for file in $(tq --query-only "$1" | grep -oE "src/.*\.ts"); do
  echo "Processing: $file"
done
```

## Exit Codes

- `0` — success (found results or no error)
- `1` — error (query missing, API error, etc.)

## License

Part of CIC system.
