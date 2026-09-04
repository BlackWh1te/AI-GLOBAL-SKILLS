import { test, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { DBManager } from '@blackwh1te/core';
import { InstallationService } from '../index';
import { ProcessManager } from '@blackwh1te/process-manager';

const TEST_DIR = path.join(process.cwd(), '.test-env');
const DB_PATH = path.join(TEST_DIR, 'state.sqlite');
const INSTALL_DIR = path.join(TEST_DIR, 'installed');

let db: DBManager;
let installer: InstallationService;
let pm: ProcessManager;

// We will use a known safe small package for testing like `is-even` or a mock if we had one.
// Let's test with `is-even` just to prove the lifecycle. (It has no scripts, small).
const PKG_NAME = 'is-even';

beforeAll(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
  db = new DBManager(DB_PATH);
  installer = new InstallationService(db, INSTALL_DIR);
  pm = new ProcessManager();
});

afterAll(() => {
  try {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    console.error('Failed to clean up test dir:', e);
  }
});

test('inspectAndPlan returns a valid plan', async () => {
  const plan = await installer.inspectAndPlan(PKG_NAME, '1.0.0');
  expect(plan.serverId).toBe('is-even');
  expect(plan.version).toBe('1.0.0');
  expect(plan.integrity).toBeDefined();
  expect(plan.lifecycleScripts.length).toBe(0);
});

test('executeInstall successfully installs a package', async () => {
  const plan = await installer.inspectAndPlan(PKG_NAME, '1.0.0');
  const record = await installer.executeInstall(plan);
  
  expect(record.status).toBe('stopped');
  expect(fs.existsSync(record.installPath)).toBe(true);
  
  // Package.json should exist inside wrapper
  expect(fs.existsSync(path.join(record.installPath, 'package.json'))).toBe(true);
  // Node modules should contain the actual package
  expect(fs.existsSync(path.join(record.installPath, 'node_modules', PKG_NAME))).toBe(true);
  
  // Verify it's in DB
  const dbRecord = db.getServer('is-even');
  expect(dbRecord).not.toBeNull();
  expect(dbRecord?.version).toBe('1.0.0');
}, 30000); // 30s timeout

test('start and stop process', async () => {
  const record = db.getServer('is-even')!;
  
  // Since it's not a real MCP server, we just run node on it
  await pm.start(record.id, 'node', ['-e', 'setInterval(() => {}, 1000)'], record.installPath, {});
  
  let status = pm.getStatus(record.id);
  // Wait a bit for the process to actually transition to running
  await new Promise(r => setTimeout(r, 200));
  status = pm.getStatus(record.id);
  expect(status.state).toBe('running');
  
  await pm.stop(record.id);
  // Wait a bit for the kill signal to propagate
  await new Promise(r => setTimeout(r, 200));
  status = pm.getStatus(record.id);
  expect(status.state).toBe('stopped');
  


});

test('uninstall removes files and DB record', async () => {
  const plan = await installer.inspectAndPlan(PKG_NAME, '1.0.0');
  await installer.uninstall(plan.serverId);
  
  expect(fs.existsSync(plan.targetDir)).toBe(false);
  expect(db.getServer(plan.serverId)).toBeNull();
});

test('executeInstall blocks scripts by default', async () => {
  // Let's find a package that definitely has an install script, e.g. `sqlite3` or we just mock plan
  const plan = await installer.inspectAndPlan(PKG_NAME, '1.0.0');
  // Hack plan to have scripts
  plan.lifecycleScripts = ['postinstall'];
  
  try {
    await installer.executeInstall(plan, false);
    expect(true).toBe(false); // Should not reach here
  } catch (err: any) {
    expect(err.message).toContain('lifecycle scripts');
  }
});
