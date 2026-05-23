# CIC Operator Startup Guide
# v1.1.0 | 2026-05-23

## 1. Overview
CIC Ingestion system hardened zero-trust architecture. Data flow mandatory quarantine sandboxed extraction pipeline.

## 2. Prerequisites
- **ClamAV**: Ensure `clamscan` available (installed via `apt`).
- **Docker**: Run for sandboxed metadata extraction.
- **Node.js**: v20+ required.

## 3. One-Click Orchestration
Project root, use scripts manage system heartbeat:

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
Ingest new data secure:
1. **Quarantine**: Drop files `cic_test_root/CIC_Quarantine/`.
2. **Perimeter Scan**: Scanner (running via `start-cic.sh`) auto scan files ClamAV.
3. **Inbox**: Clean files move `CIC_Inbox`.
4. **Sandboxed Harvester**: Run `npm run harvester` (or wait pipeline). Extraction occur inside isolated Docker container.

## 5. Observability (Security Dashboard)
Open `dashboard/index.html` browser.
- **SEC-OPS Panel**: Real-time malware detection metrics, sandbox health.
- **Event Log**: Live audit trail scan results, extraction runs.

## 6. Defensive Guardrails
- **Git Protection**: Gitleaks, Husky auto block commits containing API keys, secrets.
- **Dependency Audits**: Run `npm audit` check library vulnerabilities.
- **Secure Parsing**: Ingestion server use `busboy` prevent DoS, malformed request exploits.