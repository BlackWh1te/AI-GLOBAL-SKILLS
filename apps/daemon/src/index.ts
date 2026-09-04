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
app.use(express.json({ limit: '100kb' }));

import { randomBytes, createHash } from 'crypto';
const TOKEN_FILE = path.join(os.homedir(), '.gemini', 'config', '.global-mcp-token');
let DAEMON_TOKEN = '';
if (fs.existsSync(TOKEN_FILE)) {
  DAEMON_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
} else {
  DAEMON_TOKEN = randomBytes(32).toString('hex');
  const configDir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, DAEMON_TOKEN, { mode: 0o600 });
}

app.use((req, res, next) => {
  // Allow health and UI without token, but validate Host/Origin
  if (req.headers.host && !['localhost', '127.0.0.1'].some(h => (req.headers.host as string).includes(h))) {
    return res.status(403).json({ error: 'Invalid Host' });
  }
  if (req.headers.origin && !['http://localhost', 'http://127.0.0.1'].some(o => (req.headers.origin as string).startsWith(o))) {
    return res.status(403).json({ error: 'Invalid Origin' });
  }

  // Exempt GET endpoints and OPTIONS
  if (req.method === 'GET' || req.method === 'OPTIONS') return next();

  // Validate Token for mutations
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${DAEMON_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

const previewTokens = new Map<string, { oldHash: string, newHash: string, expires: number }>();


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
    try { fs.unlinkSync(LOCK_FILE); } catch (e) { console.error('Failed to release lock', e); }
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
    const server = dbManager.getServer(id);
    if(!server) return res.status(404).json({error: "Not found"});
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    const resolvedEnv = await SecretsManager.resolveEnv(server.env);
    await pm.start(id, command, args || [], cwd, resolvedEnv);
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
import { DBManager, SecretsManager } from '@blackwh1te/core';
import * as diff from 'diff';

const registryClient = new RegistryClient();
const npmScanner = new NpmScanner();
const dbManager = new DBManager();
const installer = new InstallationService(dbManager);

app.get('/api/registry/servers', (req, res) => {
  try {
    const servers = dbManager.getServers();
    const redactedServers = servers.map(server => {
      let redactedEnv = '{}';
      try {
        const parsed = JSON.parse(server.env || '{}');
        const redacted: Record<string, string> = {};
        for (const key of Object.keys(parsed)) {
          redacted[key] = '********';
        }
        redactedEnv = JSON.stringify(redacted);
      } catch (e) {
        console.error('Failed to parse env for redaction', e);
      }
      return { ...server, env: redactedEnv };
    });
    res.json(redactedServers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/registry/servers/:id/env', async (req, res) => {
  try {
    const { env } = req.body;
    const server = dbManager.getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    
    // Only update non-redacted fields (if client passes '********' it means unchanged)
    const existingEnv = JSON.parse(server.env || '{}');
    
    const newEnv = { ...existingEnv };
    for (const key of Object.keys(env)) {
      if (env[key] !== '********') {
        const ref = await SecretsManager.storeSecret(server.id, key, env[key]);
        newEnv[key] = ref;
      }
    }
    server.env = JSON.stringify(newEnv);

    dbManager.upsertServer(server);
    res.json({ success: true });
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

app.post('/api/adapters/:adapterId/preview', async (req, res) => {
  try {
    const { adapterId } = req.params;
    const { serverId } = req.body;
    
    const adapter = adapters.find(a => a.id === adapterId);
    if (!adapter) return res.status(404).json({ error: 'Adapter not found' });
    
    const server = dbManager.getServer(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    let oldConfig = '{}';
    if (fs.existsSync(adapter.getConfigPath())) {
      oldConfig = fs.readFileSync(adapter.getConfigPath(), 'utf8');
    }
    
    const args = JSON.parse(server.args || '[]');
    const env = JSON.parse(server.env || '{}');
    const newConfig = adapter.previewConfig(serverId, server.command, args, env);
    
    
    const oldHash = createHash('sha256').update(oldConfig).digest('hex');
    const newHash = createHash('sha256').update(newConfig).digest('hex');
    const token = randomBytes(16).toString('hex');
    previewTokens.set(token, { oldHash, newHash, expires: Date.now() + 60000 });
    
    const textDiff = diff.createTwoFilesPatch(
      'current_config.json',
      'new_config.json',
      oldConfig,
      newConfig,
      'Current',
      'New'
    );
    res.json({ oldConfig, newConfig, previewToken: token, oldHash, newHash, diff: textDiff });


  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/adapters/:adapterId/inject', async (req, res) => {
  try {
    const { adapterId } = req.params;
    const { serverId, previewToken, expectedOldHash } = req.body;

    const tokenData = previewTokens.get(previewToken);
    if (!tokenData || Date.now() > tokenData.expires) {
      return res.status(400).json({ error: 'Invalid or expired preview token' });
    }
    if (tokenData.oldHash !== expectedOldHash) {
      return res.status(400).json({ error: 'Hash mismatch' });
    }
    previewTokens.delete(previewToken);

    const adapter = adapters.find(a => a.id === adapterId);
    if (!adapter) return res.status(404).json({ error: 'Adapter not found' });
    
    const server = dbManager.getServer(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    let currentConfig = '{}';
    if (fs.existsSync(adapter.getConfigPath())) {
      currentConfig = fs.readFileSync(adapter.getConfigPath(), 'utf8');
    }
    const currentHash = createHash('sha256').update(currentConfig).digest('hex');
    if (currentHash !== expectedOldHash) {
      return res.status(409).json({ error: 'Config file changed on disk since preview' });
    }

    const args = JSON.parse(server.args || '[]');
    const resolvedEnv = await SecretsManager.resolveEnv(server.env);
    
    await adapter.applyConfig(serverId, server.command, args, resolvedEnv);
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
