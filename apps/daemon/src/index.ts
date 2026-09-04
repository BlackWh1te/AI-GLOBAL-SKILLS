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
import { ProcessManager } from '@blackwh1te/process-manager';

const pm = new ProcessManager();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ready', version: pkg.version });
});

// Process Management Endpoints
app.post('/api/servers/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const { command, args, env, cwd } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    await pm.start(id, command, args || [], cwd, env || {});
    res.json({ success: true, status: pm.getStatus(id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/stop', async (req, res) => {
  try {
    await pm.stop(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/servers/:id/status', (req, res) => {
  res.json(pm.getStatus(req.params.id));
});

app.get('/api/servers/:id/logs', (req, res) => {
  res.json({ logs: pm.getLogs(req.params.id) });
});

import { adapters } from '@blackwh1te/client-adapters';
import { RegistryClient, NpmScanner } from '@blackwh1te/registry';
import { InstallationService } from '@blackwh1te/installer';
import { DBManager } from '@blackwh1te/core';

const registryClient = new RegistryClient();
const npmScanner = new NpmScanner();
const dbManager = new DBManager();
const installer = new InstallationService(dbManager);

app.get('/api/registry/servers', (req, res) => {
  try {
    const servers = dbManager.getServers();
    res.json(servers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/registry/install/plan', async (req, res) => {
  try {
    const { locator, version } = req.body;
    const plan = await installer.inspectAndPlan(locator, version);
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/registry/install', async (req, res) => {
  try {
    const { plan, approveScripts } = req.body;
    const record = await installer.executeInstall(plan, approveScripts || false);
    res.json({ success: true, server: record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/registry/servers/:id', async (req, res) => {
  try {
    await installer.uninstall(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/registry/search', async (req, res) => {
  try {
    const q = req.query.q as string || '';
    const local = registryClient.search(q);
    const npm = await npmScanner.searchMcpServers(q);
    res.json({ local, npm });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/adapters', (req, res) => {
  res.json(adapters.map(a => ({
    id: a.id,
    name: a.name,
    installed: a.isInstalled(),
    configPath: a.getConfigPath()
  })));
});

app.post('/api/adapters/:adapterId/inject', async (req, res) => {
  try {
    const { adapterId } = req.params;
    const { serverId, command, args, env } = req.body;
    
    const adapter = adapters.find(a => a.id === adapterId);
    if (!adapter) {
      return res.status(404).json({ error: 'Adapter not found' });
    }
    
    await adapter.applyConfig(serverId, command, args, env);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit', (req, res) => {
  const { AuditLogger } = require('@blackwh1te/core');
  const audit = new AuditLogger();
  res.json(audit.getHistory());
});

app.post('/api/adapters/:adapterId/rollback', async (req, res) => {
  try {
    const { adapterId } = req.params;
    const adapter = adapters.find(a => a.id === adapterId);
    if (!adapter) {
      return res.status(404).json({ error: 'Adapter not found' });
    }
    
    // Simplistic rollback: if .bak exists, copy it back
    const configPath = adapter.getConfigPath();
    const fs = require('fs');
    
    // Find latest backup
    const dir = require('path').dirname(configPath);
    if (!fs.existsSync(dir)) return res.status(400).json({ error: 'No config dir' });
    
    const files = fs.readdirSync(dir);
    const backups = files.filter((f: string) => f.startsWith(require('path').basename(configPath) + '.bak.'));
    if (backups.length === 0) {
      return res.status(400).json({ error: 'No backups found' });
    }
    
    backups.sort();
    const latestBackup = backups[backups.length - 1];
    fs.copyFileSync(require('path').join(dir, latestBackup), configPath);
    
    // Log rollback
    const { AuditLogger } = require('@blackwh1te/core');
    new AuditLogger().log('CONFIG_ROLLBACK', 'N/A', { adapter: adapterId, restoredFrom: latestBackup });
    
    res.json({ success: true, restoredFrom: latestBackup });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
    openBrowser(url);
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
