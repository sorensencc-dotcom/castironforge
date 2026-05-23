#!/bin/bash
# file: start-cic.sh
# version: 1.0.0
# Central Hub for CIC Secure Operations.
# This script starts the MCP, Ingestion Server, and Scanner.

# Colors
GREEN='\033[0u32m'
RED='\033[0u31m'
NC='\033[0m'

echo -e "${GREEN}Starting CIC Secure Operations...${NC}"

# 1. Start MCP (Security Dashboard Backend)
echo "Starting Security Telemetry Hub (MCP)..."
MCP_HTTP_PORT=3000 MCP_WS_PORT=3001 MCP_AGENT_ID=mcp-hub node ops/run-mcp.js > logs/mcp.log 2>&1 &
MCP_PID=$!

# 2. Start Intelligence Server (Ingestion Project)
echo "Starting CIC Intelligence Server..."
cd projects/cic/ingestion && npm start > ../../../logs/intelligence.log 2>&1 &
INTEL_PID=$!
cd ../../../

# 3. Start Malware Scanner
echo "Starting Perimeter Scanner..."
node ops/run-scanner.js > logs/scanner.log 2>&1 &
SCANNER_PID=$!

echo -e "${GREEN}All services started!${NC}"
echo "------------------------------------------------"
echo "Security Dashboard: http://localhost:3000/security/telemetry"
echo "Intelligence API:   http://localhost:4000"
echo "Pipeline Observatory: Open dashboard/index.html in your browser."
echo "------------------------------------------------"
echo "To stop all services, run: ./stop-cic.sh"

# Store PIDs for cleanup
echo "$MCP_PID" > .cic_pids
echo "$INTEL_PID" >> .cic_pids
echo "$SCANNER_PID" >> .cic_pids

# Open the dashboard automatically (if 'open' is available)
if command -v xdg-open &> /dev/null; then
    xdg-open dashboard/index.html
elif command -v open &> /dev/null; then
    open dashboard/index.html
fi
