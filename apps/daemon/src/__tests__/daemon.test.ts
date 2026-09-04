import { test, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const DAEMON_ENTRY = path.join(process.cwd(), 'src/index.ts');
const LOCK_FILE = path.join(process.cwd(), '.global-mcp.lock');

beforeAll(() => {
  if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
});

afterAll(() => {
  if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
});

test('daemon starts on default port and checks health', async () => {
  const proc = spawn('bun', [DAEMON_ENTRY]);
  
  proc.stderr.on('data', d => console.error('DAEMON ERR:', d.toString()));
  proc.stdout.on('data', d => console.log('DAEMON OUT:', d.toString()));
  
  // Wait for it to boot
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    const res = await fetch('http://127.0.0.1:3000/api/health');
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.status).toBe('ready');
  } finally {
    proc.kill('SIGTERM');
  }
});

test('daemon prevents duplicate instances via lockfile', async () => {
  const proc1 = spawn('bun', [DAEMON_ENTRY]);
  await new Promise(r => setTimeout(r, 500));
  
  const proc2 = spawn('bun', [DAEMON_ENTRY]);
  
  const p2Exit = new Promise<number | null>(resolve => {
    proc2.on('close', resolve);
  });
  
  const exitCode = await p2Exit;
  expect(exitCode).not.toBe(0); // Should fail because of lockfile
  
  proc1.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 500));
});
