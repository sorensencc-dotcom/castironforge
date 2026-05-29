import open from 'open';
import { execSync } from 'node:child_process';
import { log } from '../src/lib/logger.js';

const MODULE = 'LAUNCHER';

async function main() {
  try {
    log('INFO', MODULE, 'Starting CIC Services via PM2...');
    
    // Start PM2 processes
    execSync('pm2 start ecosystem.config.cjs', { stdio: 'inherit' });
    
    log('INFO', MODULE, 'Services started. Opening Dashboard...');
    
    // Wait a moment for server to bind
    await new Promise(r => setTimeout(r, 2000));
    
    // Open the browser
    await open('http://localhost:3000/dashboard');
    
    log('INFO', MODULE, 'Dashboard opened successfully.');
    
    process.exit(0);
  } catch (err) {
    log('ERROR', MODULE, `Launcher failed: ${err.message}`);
    process.exit(1);
  }
}

main();
