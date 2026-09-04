import { Command } from 'commander';
import os from 'os';
import { execSync } from 'child_process';

const program = new Command();
const API_BASE = 'http://127.0.0.1:3000/api';

async function fetchApi(apiPath: string, options?: RequestInit) {
  const os = require('os');
  const fs = require('fs');
  const p = require('path');
  const tokenFile = p.join(os.homedir(), '.gemini', 'config', '.global-mcp-token');
  let token = '';
  if (fs.existsSync(tokenFile)) token = fs.readFileSync(tokenFile, 'utf8').trim();
  
  options = options || {};
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

program
  .name('global-mcp')
  .description('CLI for Global MCP Control Plane')
  .version('0.1.0');

program.command('status')
  .description('Check daemon health')
  .action(async () => {
    const data = await fetchApi('/health');
    console.log(`Daemon is running (v${data.version})`);
  });

program.command('list')
  .description('List installed servers')
  .action(async () => {
    const data = await fetchApi('/registry/servers');
    if (data.length === 0) {
      console.log('No servers installed.');
      return;
    }
    console.table(data.map((s: any) => ({ ID: s.id, Name: s.name, Version: s.version, Status: s.status })));
  });

program.command('search <query>')
  .description('Search registry for MCP servers')
  .action(async (query) => {
    const data = await fetchApi(`/registry/search?q=${encodeURIComponent(query)}`);
    console.log('Local Results:', data.local.length);
    console.log('NPM Results:', data.npm.length);
    data.npm.slice(0, 10).forEach((p: any) => {
      console.log(`- ${p.name} (v${p.version}): ${p.description}`);
    });
  });

program.command('install <locator>')
  .description('Install an MCP server from NPM')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option('--approve-scripts', 'Approve lifecycle scripts execution')
  .action(async (locator, options) => {
    console.log(`Planning installation for ${locator}...`);
    const plan = await fetchApi('/registry/install/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locator })
    });
    
    console.log('\n--- Install Plan ---');
    console.log(`Server ID:  ${plan.serverId}`);
    console.log(`Version:    ${plan.version}`);
    console.log(`Target:     ${plan.targetDir}`);
    console.log(`License:    ${plan.license}`);
    console.log(`Integrity:  ${plan.integrity}`);
    console.log(`Binaries:   ${plan.binaries.join(', ') || 'None'}`);
    console.log(`Scripts:    ${plan.lifecycleScripts.join(', ') || 'None'}`);
    console.log(`Risk Level: ${plan.riskAnalysis}`);
    console.log('--------------------\n');
    
    if (plan.lifecycleScripts.length > 0 && !options.approveScripts) {
      console.log('WARNING: This package contains lifecycle scripts. Installation is blocked by default.');
      console.log('To proceed, you must pass --approve-scripts if you trust this package.');
      process.exit(1);
    }
    
    if (!options.yes) {
      const ans = prompt('Approve installation? (y/n) ');
      if (ans?.toLowerCase() !== 'y') {
        console.log('Aborted.');
        return;
      }
    }
    
    console.log('Installing (this may take a minute)...');
    const res = await fetchApi('/registry/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, approveScripts: options.approveScripts || false })
    });
    console.log(`Successfully installed ${res.server.name} as ${res.server.id}`);
  });

program.command('start <id>')
  .description('Start a server')
  .action(async (id) => {
    // Need to get server details to know command
    const servers = await fetchApi('/registry/servers');
    const srv = servers.find((s: any) => s.id === id);
    if (!srv) {
      console.error('Server not found in DB.');
      process.exit(1);
    }
    
    const res = await fetchApi(`/servers/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: srv.command,
        args: JSON.parse(srv.args),
        env: JSON.parse(srv.env || '{}'),
        cwd: srv.installPath
      })
    });
    console.log(`Started ${id}, PID: ${res.status.pid}`);
  });

program.command('stop <id>')
  .description('Stop a server')
  .action(async (id) => {
    await fetchApi(`/servers/${id}/stop`, { method: 'POST' });
    console.log(`Stopped ${id}`);
  });

program.command('logs <id>')
  .description('View logs for a server')
  .action(async (id) => {
    const data = await fetchApi(`/servers/${id}/logs`);
    console.log(data.logs.join('\n'));
  });

program.command('dashboard')
  .description('Open local dashboard')
  .action(() => {
    const url = 'http://127.0.0.1:3000'; // Or vite port
    console.log(`Opening ${url}`);
    let command;
    switch (os.platform()) {
      case 'win32': command = `start "" "${url}"`; break;
      case 'darwin': command = `open "${url}"`; break;
      default: command = `xdg-open "${url}"`; break;
    }
    execSync(command);
  });

program.command('uninstall <id>')
  .description('Uninstall a server')
  .action(async (id) => {
    await fetchApi(`/registry/servers/${id}`, { method: 'DELETE' });
    console.log(`Uninstalled ${id}`);
  });

program.command('configure <client> <server-id>')
  .description('Configure a client for an installed server')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (client, serverId, options) => {
    const preview = await fetchApi(`/adapters/${client}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId })
    });
    
    console.log('--- Current Config ---');
    console.log(preview.oldConfig);
    console.log('\n--- New Config ---');
    console.log(preview.newConfig);
    
    if (!options.yes) {
      const ans = prompt('Apply configuration? (y/n) ');
      if (ans?.toLowerCase() !== 'y') {
         console.log('Aborted.');
         return;
      }
    }
    
    await fetchApi(`/adapters/${client}/inject`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ serverId })
    });
    console.log('Configuration applied successfully.');
  });

program.command('env:set <server-id> <key> <value>')
  .description('Set an environment variable securely')
  .action(async (serverId, key, value) => {
    const servers = await fetchApi('/registry/servers');
    const srv = servers.find((s: any) => s.id === serverId);
    if (!srv) {
       console.error('Server not found');
       process.exit(1);
    }
    // servers API returns redacted env vars. If we update, we only send the delta, or we merge.
    // Wait, PUT /api/registry/servers/:id/env only updates non-'********' values!
    // So we can send { [key]: value }
    const envDelta = { [key]: value };
    await fetchApi(`/registry/servers/${serverId}/env`, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ env: envDelta })
    });
    console.log(`Set ${key} securely for ${serverId}.`);
  });

program.command('clients')
  .description('List available AI clients')
  .action(async () => {
    const data = await fetchApi('/adapters');
    console.table(data.map((c: any) => ({ ID: c.id, Name: c.name, Installed: c.installed })));
  });

program.parse(process.argv);
