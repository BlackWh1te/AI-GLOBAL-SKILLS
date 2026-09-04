import { test, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const DAEMON_ENTRY = path.join(process.cwd(), 'src/index.ts');
const LOCK_FILE = path.join(process.cwd(), '.global-mcp.lock');
const TOKEN_FILE = path.join(os.homedir(), '.gemini', 'config', '.global-mcp-token');

let proc: any;
let token = '';

beforeAll(async () => {
  if (fs.existsSync(LOCK_FILE)) try { fs.unlinkSync(LOCK_FILE); } catch(e){}
  
  proc = spawn('bun', [DAEMON_ENTRY]);
  await new Promise(r => setTimeout(r, 2000));
  if (fs.existsSync(TOKEN_FILE)) {
    token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  }
});

afterAll(async () => {
  if (proc) proc.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 1000));
  if (fs.existsSync(LOCK_FILE)) try { fs.unlinkSync(LOCK_FILE); } catch(e){}
});

test('daemon rejects missing token for mutations', async () => {
  const res = await fetch('http://127.0.0.1:3000/api/registry/servers/test/env', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ env: {} })
  });
  expect(res.status).toBe(401);
});

test('daemon accepts valid token for mutations', async () => {
  const res = await fetch('http://127.0.0.1:3000/api/registry/servers/test/env', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ env: {} })
  });
  // Should be 404 because server 'test' doesn't exist, but it passed auth!
  expect(res.status).toBe(404);
});

test('daemon rejects invalid Host header', async () => {
  const res = await fetch('http://127.0.0.1:3000/api/health', {
    headers: { 'Host': 'evil.com:3000' }
  });
  expect(res.status).toBe(403);
});
