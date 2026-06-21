# CIC Typesense Indexer Service Manifest

**Service Name:** typesense-indexer  
**Service Type:** Data Ingestion  
**Service Tier:** Critical  
**Introduced:** Phase 26  
**Status:** Production-Ready  

---

## Service Overview

The Typesense Indexer is a critical CIC microservice that watches filesystem changes, extracts code metadata and structure, and maintains a deterministic, real-time searchable index of all CIC repositories.

**Key Characteristics:**
- **Stateless:** Can restart without data loss (index persists in Typesense)
- **Deterministic:** Same code → same index state (via SHA-256 deduplication)
- **Real-time:** Files indexed within 5 seconds of change
- **Self-healing:** Detects and recovers from drift via hash comparison
- **Observable:** Full logging, metrics, health checks

---

## Subsystem Architecture

```
typesense-indexer/
├── config.ts              → CIC Config Registry
├── logger.ts              → CIC Unified Logging
├── typesenseClient.ts     → CIC Service Adapter
├── schema.ts              → CIC Schema Registry
├── watcher.ts             → CIC Ingestion Bus
├── metadataExtractor.ts   → CIC Evidence Packets
├── astParser.ts           → CIC Structural Extractors
├── indexer.ts             → CIC Ingestion Core
├── main.ts                → CIC Microservice
└── package.json, tsconfig.json, README.md
```

---

## Service Dependencies

### External Dependencies

| Service | Type | Purpose | Required | Port |
|---------|------|---------|----------|------|
| Typesense | Data Store | Code search index | YES | 8108 |
| CIC Config Registry | Config | Repo paths, ignore patterns | YES | internal |
| CIC Logging | Telemetry | Structured logs | YES | internal |
| CIC Service Mesh | Discovery | Service registration | NO | internal |

### Internal Dependencies

| Module | Purpose |
|--------|---------|
| config.ts | Load and validate configuration |
| logger.ts | Emit structured logs |
| typesenseClient.ts | Connect to Typesense cluster |
| schema.ts | Define and create collections |
| watcher.ts | Monitor files for changes |
| metadataExtractor.ts | Extract tags and metadata |
| astParser.ts | Parse code structure |
| indexer.ts | Upsert/delete documents |

### Optional Dependencies

| Service | Type | Purpose |
|---------|------|---------|
| CIC Ingestion Bus | Message Queue | Route events (Kafka, Redis, etc.) |
| CIC Call Graph Engine | Dependency Graph | Store symbol relationships |
| CIC Observability Dashboard | Dashboards | Display metrics and logs |

---

## Configuration Schema

All configuration via `CIC_INDEXER_*` environment variables or config registry.

```yaml
indexer:
  enabled: true
  
  # Repository configuration
  repos:
    - path: /code/castironforge
      name: castironforge
      phase: 26
      adapter: ""
    - path: /code/other-repo
      name: other-repo
      phase: 27
      adapter: CustomAdapter
  
  # File watching
  watcher:
    debounceMs: 500
    batchSize: 100
    batchTimeoutMs: 5000
    ignorePatterns:
      - "node_modules/**"
      - ".git/**"
      - "dist/**"
      - "build/**"
      - ".next/**"
      - "coverage/**"
      - "*.log"
  
  # Language support
  languages:
    - ext: .ts
      lang: typescript
    - ext: .js
      lang: javascript
    - ext: .py
      lang: python
    - ext: .md
      lang: markdown
  
  # Typesense connection
  typesense:
    host: localhost
    port: 8108
    protocol: http
    apiKey: dev-key
    retries: 5
    retryDelayMs: 100
  
  # Indexing behavior
  indexing:
    parallelBatches: 3
    maxRetries: 5
    retryBackoffMs: [100, 200, 500, 1000]
    circuitBreakerThreshold: 3
    hashAlgorithm: sha256
    deduplication: true
  
  # Metadata extraction
  metadata:
    extractPhase: true
    extractAdapter: true
    extractTodos: true
    extractTags:
      - pattern: "@phase-(\\d+)"
        field: phase
      - pattern: "@adapter:(\\w+)"
        field: adapter
      - pattern: "TODO|FIXME"
        field: todos
      - pattern: "@cic:(\\w+)"
        field: cic_tags
  
  # Health checks
  health:
    checkIntervalMs: 30000
    typesenseTimeoutMs: 5000
    watcherTimeoutMs: 10000
  
  # Logging
  logging:
    level: info  # debug, info, warn, error
    format: json
    categories:
      - indexer.fs
      - indexer.ast
      - indexer.typesense
      - indexer.health
```

### Environment Variables

```bash
# Required
CIC_INDEXER_ENABLED=true
CIC_INDEXER_REPOS_0_PATH=/code/castironforge
CIC_INDEXER_REPOS_0_NAME=castironforge
CIC_INDEXER_REPOS_0_PHASE=26

# Typesense
CIC_INDEXER_TYPESENSE_HOST=localhost
CIC_INDEXER_TYPESENSE_PORT=8108
CIC_INDEXER_TYPESENSE_PROTOCOL=http
CIC_INDEXER_TYPESENSE_API_KEY=dev-key

# Optional
CIC_INDEXER_WATCHER_DEBOUNCE_MS=500
CIC_INDEXER_INDEXING_PARALLEL_BATCHES=3
CIC_INDEXER_LOGGING_LEVEL=info
```

---

## Ports and Endpoints

### Health Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| /health | GET | Service health | `{ status, timestamp, checks }` |
| /metrics | GET | Prometheus metrics | Prometheus format |
| /status | GET | Detailed status | `{ running_since, indexed_count, errors, uptime }` |

**Health Response Example:**
```json
{
  "status": "healthy",
  "timestamp": "2026-06-21T12:00:00Z",
  "checks": {
    "typesense": { "ok": true, "latency_ms": 2 },
    "watcher": { "ok": true, "files_watched": 1247 },
    "batching": { "ok": true, "pending_batches": 0 }
  },
  "uptime_seconds": 86400
}
```

### No External Ports (Headless Service)

The indexer does not expose external ports. It reads from filesystem, writes to Typesense, and emits logs. Integration is via:
- Configuration (CIC Config Registry)
- Logging (CIC Logging Layer)
- Service Health (health endpoints)
- Metrics (Prometheus scraping)

---

## Operational Requirements

### System Resources

| Resource | Requirement | Notes |
|----------|-------------|-------|
| CPU | 1-2 cores | Parsing is single-threaded per file |
| Memory | 512 MB - 2 GB | Depends on batch size and file size |
| Disk | 10 GB (local) | Cache for deduplication |
| Network | 100 Mbps | For Typesense communication |

### Runtime Environment

| Requirement | Specification |
|-------------|---|
| Node.js | 20.x LTS or later |
| OS | Linux, macOS, Windows |
| Package Manager | npm 10.x or pnpm |
| TypeScript | 5.x (dev dependency) |

### Network Access

| Destination | Port | Protocol | Purpose |
|-------------|------|----------|---------|
| Typesense cluster | 8108 | HTTP/HTTPS | Index operations |
| CIC Logging | internal | TCP | Log shipping |
| CIC Config Registry | internal | TCP | Config loading |
| CIC Ingestion Bus | internal | TCP/UDP | Event routing |

---

## Deployment Manifests

### Docker

**Dockerfile**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY README.md ./

ENV NODE_ENV=production
EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/main.js"]
```

**docker-compose.yml**
```yaml
version: '3.8'

services:
  typesense-indexer:
    build:
      context: ./typesense-indexer
      dockerfile: Dockerfile
    container_name: cic-indexer
    restart: unless-stopped
    
    environment:
      NODE_ENV: production
      CIC_INDEXER_ENABLED: "true"
      CIC_INDEXER_REPOS_0_PATH: /code
      CIC_INDEXER_REPOS_0_NAME: castironforge
      CIC_INDEXER_REPOS_0_PHASE: "26"
      CIC_INDEXER_TYPESENSE_HOST: typesense
      CIC_INDEXER_TYPESENSE_PORT: 8108
      CIC_INDEXER_TYPESENSE_API_KEY: dev-key
      CIC_INDEXER_LOGGING_LEVEL: info
    
    volumes:
      - /code:/code:ro  # Read-only mount of repo
      - indexer-cache:/app/cache  # Local cache for deduplication
    
    depends_on:
      typesense:
        condition: service_healthy
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=cic-indexer"
    
    networks:
      - cic-network

  typesense:
    image: typesense/typesense:latest
    container_name: cic-typesense
    restart: unless-stopped
    
    environment:
      TYPESENSE_API_KEY: dev-key
    
    volumes:
      - typesense-data:/data
    
    ports:
      - "8108:8108"
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8108/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    
    networks:
      - cic-network

volumes:
  typesense-data:
  indexer-cache:

networks:
  cic-network:
    driver: bridge
```

### Kubernetes

**configmap.yaml**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: indexer-config
  namespace: cic
data:
  CIC_INDEXER_ENABLED: "true"
  CIC_INDEXER_REPOS_0_NAME: castironforge
  CIC_INDEXER_REPOS_0_PHASE: "26"
  CIC_INDEXER_TYPESENSE_HOST: typesense.cic.svc.cluster.local
  CIC_INDEXER_TYPESENSE_PORT: "8108"
  CIC_INDEXER_LOGGING_LEVEL: info
  CIC_INDEXER_WATCHER_DEBOUNCE_MS: "500"
```

**deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: typesense-indexer
  namespace: cic
spec:
  replicas: 1  # Stateless, can scale if needed
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 0
      maxUnavailable: 1
  
  selector:
    matchLabels:
      app: typesense-indexer
  
  template:
    metadata:
      labels:
        app: typesense-indexer
        tier: data-ingestion
    
    spec:
      serviceAccountName: indexer
      restartPolicy: Always
      
      containers:
      - name: indexer
        image: cic/typesense-indexer:latest
        imagePullPolicy: Always
        
        envFrom:
        - configMapRef:
            name: indexer-config
        
        env:
        - name: CIC_INDEXER_REPOS_0_PATH
          value: /code
        - name: NODE_ENV
          value: production
        
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        
        livenessProbe:
          httpGet:
            path: /health
            port: 9000
          initialDelaySeconds: 15
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health
            port: 9000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 2
        
        volumeMounts:
        - name: code
          mountPath: /code
          readOnly: true
        - name: cache
          mountPath: /app/cache
      
      volumes:
      - name: code
        persistentVolumeClaim:
          claimName: cic-code-pvc
      - name: cache
        emptyDir: {}
```

**service.yaml**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: typesense-indexer
  namespace: cic
spec:
  type: ClusterIP
  clusterIP: None  # Headless service
  selector:
    app: typesense-indexer
  ports:
  - name: health
    port: 9000
    targetPort: 9000
    protocol: TCP
```

---

## Observability

### Metrics

**Prometheus Metrics**

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `cic_indexer_files_total` | Counter | repo, phase, action | Total files processed (add/change/delete) |
| `cic_indexer_documents_indexed_total` | Counter | repo, phase | Total documents indexed |
| `cic_indexer_documents_deleted_total` | Counter | repo | Total documents deleted |
| `cic_indexer_indexing_latency_ms` | Histogram | repo, operation | Time per operation (upsert/delete) |
| `cic_indexer_typesense_latency_ms` | Histogram | operation | Typesense API latency |
| `cic_indexer_parsing_latency_ms` | Histogram | language | AST parsing time per file |
| `cic_indexer_batch_latency_ms` | Histogram | repo | Batch processing time |
| `cic_indexer_errors_total` | Counter | repo, type | Error count (connection, parse, etc.) |
| `cic_indexer_stale_documents_total` | Gauge | repo | Documents with stale hash |
| `cic_indexer_watched_files` | Gauge | repo | Current watch list size |
| `cic_indexer_pending_batches` | Gauge | repo | Batches awaiting upload |
| `cic_indexer_uptime_seconds` | Gauge | - | Service uptime |

**Scrape Configuration**
```yaml
scrape_configs:
  - job_name: 'cic-indexer'
    static_configs:
      - targets: ['localhost:9000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 5s
```

### Logging

**Log Categories**

| Category | Level | Purpose | Example |
|----------|-------|---------|---------|
| `indexer.fs` | info | File watch events | "ADD src/agents/warmPoolAgent.ts" |
| `indexer.ast` | debug | AST parsing | "Parsed 45 symbols from xyz.ts" |
| `indexer.typesense` | info | Indexing operations | "Upserted 100 documents in 250ms" |
| `indexer.health` | info | Service health | "Health check passed" |
| `indexer.error` | error | Errors | "Connection refused: typesense:8108" |

**Log Format (JSON)**
```json
{
  "timestamp": "2026-06-21T12:00:00.000Z",
  "level": "info",
  "category": "indexer.fs",
  "message": "File changed",
  "repo": "castironforge",
  "path": "src/agents/warmPoolAgent.ts",
  "event": "CHANGE",
  "phase": "26",
  "correlation_id": "abc123xyz"
}
```

### Health Checks

**Startup Health Check**
- Verify config loaded
- Verify Typesense connected
- Verify schema exists
- Verify watcher initialized

**Running Health Check (every 30s)**
- Ping Typesense (latency < 5s)
- Check watcher is active (files_watched > 0)
- Check no hung batches (pending_batches < 10)

**Degraded State**
- Typesense unreachable: indexing paused, retrying
- Too many pending batches: throttle watcher
- Parsing errors > 100: quarantine problematic file

**Unhealthy State**
- Typesense down > 5m: alert admin
- Watcher crashed: restart service
- Circuit breaker tripped: stop accepting events

---

## Lifecycle Management

### Startup Sequence

1. Load configuration from CIC Config Registry
2. Initialize logger (set level, categories)
3. Connect to Typesense (verify health, check schema)
4. Create or update code_files collection schema
5. Initialize file watcher
6. Emit ready signal
7. Begin watching repositories

**Startup Latency:** ~5-10 seconds (includes Typesense health check)

### Shutdown Sequence

1. Stop accepting new file events (watcher paused)
2. Flush pending batches to Typesense (timeout: 10s)
3. Close watcher (release file handles)
4. Disconnect from Typesense
5. Close logger (flush pending logs)
6. Exit with code 0

**Shutdown Latency:** ~10-30 seconds (includes batch flushing)

### Graceful Reload

1. Pause watcher
2. Reload config from registry
3. Validate config changes
4. Apply new ignore patterns, phase, adapter
5. Resume watcher
6. Emit reload complete signal

**Reload Latency:** ~2-5 seconds (no data loss)

---

## Error Handling and Recovery

### Connection Errors

**Typesense Connection Refused**
- Retry with exponential backoff: 100ms, 200ms, 500ms, 1s
- After 5 retries: pause indexing, emit alert
- Recovery: auto-resume when connection restored

**Typesense Timeout**
- Timeout: 5 seconds per request
- Retry: yes (up to 3 times)
- Backoff: exponential

### Data Errors

**Parse Error (AST parsing fails)**
- Log error with file and line number
- Mark file as `parse_error`
- Continue indexing (partial results if possible)
- Alert on 10+ consecutive parse errors per repo

**Invalid Document (missing required fields)**
- Reject document
- Log with document ID and missing fields
- Quarantine for review
- Do not retry

**Deduplication Error (hash mismatch)**
- Trigger reindex of file
- Compare on-disk vs. indexed version
- Update to latest version
- Log divergence

### Recovery Actions

| Error | Action | Retry | Timeout | Alert |
|-------|--------|-------|---------|-------|
| Connection refused | Exponential backoff | 5x | 30s | Yes |
| Parse error | Log + skip | No | N/A | After 10 |
| Timeout | Retry | 3x | 5s | After 3 |
| Invalid doc | Quarantine | No | N/A | Yes |
| Hash mismatch | Reindex | 1x | 10s | No |

---

## Performance Targets

| Operation | Target | Typical | Notes |
|-----------|--------|---------|-------|
| File add/change event → indexed | < 5s | 2-3s | Depends on file size and batch size |
| Batch upsert (100 docs) | < 500ms | 200-300ms | Parallel batches: 3 concurrent |
| AST parsing per file | < 100ms | 20-50ms | TypeScript/JavaScript |
| Metadata extraction | < 50ms | 10-20ms | Regex-based |
| Health check | < 5s | 1-2s | Typesense ping only |

**Capacity Targets:**
- Files per repository: 100,000+
- Repositories: 10+
- Documents indexed: 1,000,000+
- Index size: 10-50 GB (varies by code size)
- Concurrent watched files: 100,000+
- Throughput: 1,000+ documents/minute

---

## Maintenance

### Regular Tasks

**Daily**
- Monitor error rate (should be < 0.1%)
- Check indexer uptime
- Verify Typesense health
- Review logs for parse errors

**Weekly**
- Check index drift (stale_documents_total)
- Verify all repos are being indexed
- Review performance trends
- Check for memory leaks

**Monthly**
- Full index consistency check
- Review and optimize ignore patterns
- Update documentation
- Plan capacity upgrades if needed

### Backup and Recovery

**Index Backup**
- Typesense index: persist to S3 or equivalent
- Backup frequency: daily
- Retention: 30 days

**Recovery Procedure**
1. Restore Typesense backup
2. Restart indexer
3. Indexer reindexes everything (deterministic via file content)
4. Verify hash consistency

**Data Retention**
- Index: persists across restarts
- Cache: cleared on restart (rebuilt automatically)
- Logs: 30 days (configurable)

---

## Versioning and Upgrades

### Version Scheme

`MAJOR.MINOR.PATCH`

- **MAJOR:** Schema incompatible, requires migration
- **MINOR:** New features, backward compatible
- **PATCH:** Bug fixes, performance improvements

### Upgrade Procedure

1. Build new image: `docker build -t cic/typesense-indexer:X.Y.Z`
2. Stage in test environment
3. Run integration tests
4. Deploy to staging: `kubectl set image deployment/typesense-indexer indexer=cic/typesense-indexer:X.Y.Z --namespace=cic`
5. Verify health and metrics
6. Deploy to production (rolling update)
7. Monitor error rate for 24 hours

### Rollback Procedure

1. Revert to previous image: `kubectl set image deployment/typesense-indexer indexer=cic/typesense-indexer:X.Y.Z-1 --namespace=cic`
2. Monitor rollout
3. Verify health returns to normal
4. Investigate issue with previous version
5. Plan fix and re-release

---

## Support and Troubleshooting

### Common Issues

**Issue: Files not indexed**
- Check watcher is running: logs should show "Watcher started"
- Check Typesense is healthy: `curl http://localhost:8108/health`
- Check ignore patterns don't exclude the files
- Check file permissions (indexer must be able to read)

**Issue: High CPU usage**
- Reduce batch size: set `CIC_INDEXER_WATCHER_BATCH_SIZE=50`
- Reduce parallel batches: set `CIC_INDEXER_INDEXING_PARALLEL_BATCHES=1`
- Check for large files causing slow parsing

**Issue: Memory leak**
- Check for hung batches: `curl http://localhost:9000/status | jq .pending_batches`
- Restart service: `docker restart cic-indexer`
- Review logs for stuck operations

**Issue: Typesense connection timeout**
- Check Typesense is running: `curl http://localhost:8108/health`
- Check network connectivity: `ping typesense`
- Increase timeout: set `CIC_INDEXER_TYPESENSE_TIMEOUT_MS=10000`

### Logging and Debugging

**Enable debug logging:**
```bash
export CIC_INDEXER_LOGGING_LEVEL=debug
npm run dev
```

**Watch logs in real-time:**
```bash
# Docker
docker logs -f cic-indexer

# Kubernetes
kubectl logs -f deployment/typesense-indexer -n cic
```

**Export metrics:**
```bash
curl http://localhost:9000/metrics
```

**Get detailed status:**
```bash
curl http://localhost:9000/status | jq .
```

---

## Contact and Escalation

**Support:**
- Slack: #cic-indexer
- Email: cic-team@company.com
- Docs: docs/PHASE26_INDEXER_GUIDE.md

**On-Call:**
- Production issues: page on-call engineer
- Escalation path: Engineer → Lead → Manager

---

## Appendix: Complete Configuration Example

```yaml
# .env.production
CIC_INDEXER_ENABLED=true

# Repos
CIC_INDEXER_REPOS_0_PATH=/code/castironforge
CIC_INDEXER_REPOS_0_NAME=castironforge
CIC_INDEXER_REPOS_0_PHASE=26
CIC_INDEXER_REPOS_0_ADAPTER=

CIC_INDEXER_REPOS_1_PATH=/code/other-project
CIC_INDEXER_REPOS_1_NAME=other-project
CIC_INDEXER_REPOS_1_PHASE=27
CIC_INDEXER_REPOS_1_ADAPTER=CustomAdapter

# Typesense
CIC_INDEXER_TYPESENSE_HOST=typesense.prod.internal
CIC_INDEXER_TYPESENSE_PORT=8108
CIC_INDEXER_TYPESENSE_PROTOCOL=https
CIC_INDEXER_TYPESENSE_API_KEY=prod-api-key-xxxxx

# Watcher
CIC_INDEXER_WATCHER_DEBOUNCE_MS=500
CIC_INDEXER_WATCHER_BATCH_SIZE=100
CIC_INDEXER_WATCHER_BATCH_TIMEOUT_MS=5000

# Indexing
CIC_INDEXER_INDEXING_PARALLEL_BATCHES=3
CIC_INDEXER_INDEXING_MAX_RETRIES=5

# Logging
CIC_INDEXER_LOGGING_LEVEL=info
CIC_INDEXER_LOGGING_FORMAT=json
```

---

**Status:** 🚀 Production-Ready

**Last Updated:** 2026-06-21

**Maintained By:** CIC Platform Team
