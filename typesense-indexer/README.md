# Typesense Code Indexer

Production-ready code search indexer for CIC and related repositories. Watches file changes, extracts metadata and structure, and ingests into Typesense for deterministic, operator-grade code search.

## Features

- **Multi-repo awareness** — index multiple repos as one searchable collection
- **Incremental indexing** — only changed files are re-indexed
- **Structural extraction** — symbols, functions, classes, imports, exports
- **Metadata tagging** — CIC Phase markers, Adapter tags, TODO/FIXME comments
- **Deterministic search** — every field explicit, no hidden heuristics
- **Agent-friendly API** — structured queries for code search tool integration

## Architecture

Five independent, testable subsystems:

1. **Repo Watcher** (`watcher.ts`) — monitors file changes via chokidar
2. **Metadata Extractor** (`metadataExtractor.ts`) — extracts todos, phase, adapter tags
3. **AST Parser** (`astParser.ts`) — language-aware symbol and structure extraction
4. **Typesense Ingestion** (`indexer.ts`) — pushes documents into Typesense
5. **Schema Management** (`schema.ts`) — ensures collection exists and is properly configured

## Quick Start

### Prerequisites

- Typesense instance running (default: `http://localhost:8108`)
- Node 18+
- npm

### Installation

```bash
cd typesense-indexer
npm install
```

### Development

```bash
npm run dev
```

Watches repo for changes and indexes in real-time. Logs include file operations and errors.

### Production Build

```bash
npm run build
npm start
```

## Configuration

Environment variables (defaults shown):

```bash
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=dev-key
REPO_ROOT=/home/user/castironforge
```

Repos are configured in `src/config.ts`. Add repos by updating the `repos` array.

## Indexed Fields

| Field | Type | Purpose |
|-------|------|---------|
| `path` | string | File path (faceted) |
| `repo` | string | Repository name (faceted) |
| `language` | string | File language: ts, js, json, etc. (faceted) |
| `content` | string | Full file content (searchable) |
| `symbols` | string[] | Extracted identifiers: functions, classes, interfaces, types |
| `imports` | string[] | Module imports |
| `exports` | string[] | Exported identifiers |
| `functions` | string[] | Function names |
| `classes` | string[] | Class names |
| `phase` | string | CIC Phase marker (faceted) |
| `adapter` | string | Adapter name/type (faceted) |
| `todos` | string[] | TODO/FIXME comments |
| `modified` | int64 | File modification timestamp (faceted) |
| `size` | int32 | File size in bytes (faceted) |
| `hash` | string | SHA-256 content hash (deduplication) |

## Example Queries

From chat agent or command line:

```bash
# Find WarmPoolManager usage
q=WarmPoolManager&query_by=content,symbols,imports

# Find all Phase 27 adapters
filter_by=phase:=27 && adapter:!=null

# Find all TODOs
q=TODO&query_by=todos

# Find files importing Qdrant
q=qdrant&query_by=imports

# Find all functions named hydrate
q=hydrate&query_by=functions
```

## File Types Indexed

Includes: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.html`, `.css`, `.yaml`, `.yml`, `.sh`, `.bash`

Excludes: `node_modules`, `.git`, `dist`, `build`, `.next`, `archive`, `.claude`

## Integration with Chat Agent

The indexer exposes a clean interface for the chat agent to call:

```typescript
// Example tool in chat-agent
const searchCode = async (query: string, filters?: Record<string, string>) => {
  return fetch(`http://localhost:8108/collections/code_files/documents/search`, {
    method: "POST",
    body: JSON.stringify({
      q: query,
      query_by: "content,symbols,imports",
      filter_by: filters?.filter_by,
      facet_by: "repo,language,phase,adapter",
      per_page: 20
    })
  });
};
```

## Troubleshooting

### Typesense Connection Failed

Ensure Typesense is running and accessible:

```bash
curl -X GET http://localhost:8108/health
```

### Files Not Indexing

- Check file extension is in `includeExtensions`
- Check file path doesn't contain excluded directories
- Check file permissions (must be readable)
- Inspect logs for parse errors

### Parse Errors

Logged with file path. Common causes:

- Syntax errors in source files (skipped; file is still indexed with content)
- Unsupported language features (handled gracefully; falls back to regex extraction)

## Performance

- Incremental indexing: only changed files are re-indexed
- Batch upserts for multi-file changes
- ~100ms per file (indexing + parsing + upload)
- Memory: ~50MB base + file content during parsing

## Deployment

### Docker

Typesense runs in docker-compose (default setup). Indexer can run locally or as a sidecar.

### systemd

Create `/etc/systemd/system/typesense-indexer.service`:

```ini
[Unit]
Description=Typesense Code Indexer
After=network.target

[Service]
Type=simple
User=indexer
WorkingDirectory=/opt/typesense-indexer
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=10
Environment="TYPESENSE_HOST=typesense"
Environment="TYPESENSE_PORT=8108"
Environment="TYPESENSE_API_KEY=<key>"
Environment="REPO_ROOT=/data/repos"

[Install]
WantedBy=multi-user.target
```

Then:

```bash
systemctl enable typesense-indexer
systemctl start typesense-indexer
```

## License

Part of CIC system. See parent repo for details.
