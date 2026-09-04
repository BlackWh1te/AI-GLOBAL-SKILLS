import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';

const app = express();
app.use(cors());
app.use(express.json());

const LOCK_FILE = path.join(process.cwd(), '.global-mcp.lock');

// Single-instance lock
function checkLock() {
  if (fs.existsSync(LOCK_FILE)) {
    console.error('\nError: Another instance of Global MCP daemon is running.');
    console.error(`If this is a mistake, delete ${LOCK_FILE} and try again.\n`);
    process.exit(1);
  }
  fs.writeFileSync(LOCK_FILE, process.pid.toString());
}

function releaseLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try { fs.unlinkSync(LOCK_FILE); } catch (e) {}
  }
}

import pkg from '../package.json';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ready', version: pkg.version });
});

function openBrowser(url: string) {
  let command;
  switch (os.platform()) {
    case 'win32': command = `start "" "${url}"`; break;
    case 'darwin': command = `open "${url}"`; break;
    default: command = `xdg-open "${url}"`; break;
  }
  exec(command);
}

// Startup logic
async function startDaemon() {
  checkLock();

  const args = process.argv.slice(2);
  let port = 3000;
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    port = parseInt(args[portIndex + 1], 10);
  }

  const server = createServer(app);

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nError: Port ${port} is occupied.`);
      console.error(`Port ${port} is currently in use by another process.`);
      console.error(`Please provide a different port using the --port <number> option.`);
      console.error(`Example: bun run start -- --port 3001\n`);
      releaseLock();
      process.exit(1);
    }
    console.error('Server error:', err);
    releaseLock();
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    const address = server.address() as AddressInfo;
    const url = `http://${address.address}:${address.port}`;
    console.log(`Global MCP Control Plane daemon started on ${url}`);
    console.log('Daemon is healthy and ready.');
    
    // For local dev, we might open a dev dashboard instead (e.g. 5173). Let's assume the dashboard is served here eventually or runs separately.
    // openBrowser(url); // Skipped for bare API right now, the dashboard runs on Vite
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down daemon...');
    server.close(() => {
      releaseLock();
      console.log('Daemon stopped gracefully.');
      process.exit(0);
    });
    
    setTimeout(() => {
      releaseLock();
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', releaseLock);
}

startDaemon().catch(err => {
  console.error('Fatal error:', err);
  releaseLock();
  process.exit(1);
});
