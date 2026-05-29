module.exports = {
  apps: [
    {
      name: 'cic-mcp',
      script: 'ops/run-mcp.js',
      env: {
        MCP_HTTP_PORT: 3000,
        MCP_WS_PORT: 3001,
        MCP_AGENT_ID: 'mcp-hub',
        NODE_ENV: 'production'
      },
      restart_delay: 5000
    },
    {
      name: 'cic-intelligence',
      script: 'node src/server/intelligence-server.js',
      cwd: 'projects/cic/ingestion',
      env: {
        PORT: 4000,
        NODE_ENV: 'production'
      },
      restart_delay: 5000
    },
    {
      name: 'cic-scanner',
      script: 'ops/run-scanner.js',
      cron_restart: '*/5 * * * *', // Run every 5 minutes
      autorestart: false,
      env: {
        MCP_BASE_URL: 'http://localhost:3000'
      }
    }
  ]
};
