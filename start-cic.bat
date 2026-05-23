@echo off
REM file: start-cic.bat
REM version: 1.0.0
REM Windows Hub for CIC Secure Operations.

echo Starting CIC Secure Operations...

REM 1. Start MCP
start /B "MCP Hub" node ops\run-mcp.js

REM 2. Start Intelligence Server
cd projects\cic\ingestion
start /B "Intelligence Server" npm start
cd ..\..\..

REM 3. Start Malware Scanner
start /B "Scanner" node ops\run-scanner.js

echo All services started!
echo Security Dashboard: http://localhost:3000/security/telemetry
echo Intelligence API:   http://localhost:4000
echo Pipeline Observatory: dashboard\index.html
pause
