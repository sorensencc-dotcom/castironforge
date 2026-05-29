# CIC Operator Startup Guide
# v1.1.0 | 2026-05-23

## 1. Overview
CIC Ingestion hardened zero-trust. Data flow mandatory quarantine sandboxed extraction.

## 2. Prerequisites
- **ClamAV**: `clamscan` available (via `apt`).
- **Docker**: Sandboxed metadata extraction.
- **Node.js**: v20+ required.

## 3. One-Click Orchestration
Project root, scripts manage heartbeat:

### Start Services
Start Security MCP, Intelligence Server, Perimeter Scanner.
```bash
./start-cic.sh
```

### Stop Services
Safe terminate backgrounded CIC processes.
```bash
./stop-cic.sh
```

## 4. Ingestion Workflow
Ingest data secure:
1. **Quarantine**: Drop files `cic_test_root/CIC_Quarantine/`.
2. **Perimeter Scan**: Scanner (`start-cic.sh`) auto scan `ClamAV`.
3. **Inbox**: Clean files move `CIC_Inbox`.
4. **Sandboxed Harvester**: Run `npm run harvester`. Extraction inside isolated Docker.

### Verify Phase 3 MAS
Ensure the multi-agent system and LLM routing are functional:
```bash
npx tsx tests/p3-pipeline.test.ts
npx tsx tests/p3-golden.test.ts
```

## 5. Observability
Open `dashboard/index.html`.
- **SEC-OPS Panel**: Malware detection metrics, sandbox health.
- **Event Log**: Audit trail scan results, extraction runs.

## 6. Defensive Guardrails
- **Git Protection**: Gitleaks, Husky block commits with API keys, secrets.
- **Dependency Audits**: `npm audit` check vulnerabilities.
- **Secure Parsing**: `busboy` prevent DoS, exploits.