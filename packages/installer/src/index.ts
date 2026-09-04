import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { DBManager, ServerRecord } from '@BlackWh1te/core';
import { AuditLogger } from '@BlackWh1te/core';

const execAsync = util.promisify(exec);
const audit = new AuditLogger();

export interface InstallPlan {
  serverId: string;
  sourceType: string;
  locator: string;
  targetDir: string;
  version: string;
  license: string;
  integrity: string;
  command: string;
  args: string[];
}

export class InstallationService {
  private baseDir: string;
  private db: DBManager;

  constructor(db: DBManager, baseDir?: string) {
    this.db = db;
    this.baseDir = baseDir || path.join(process.cwd(), '.global-mcp-data', 'installed');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public async inspectAndPlan(locator: string, version: string = 'latest'): Promise<InstallPlan> {
    // We fetch metadata from npm to verify it exists and get exact version & integrity
    const res = await fetch(`https://registry.npmjs.org/${locator}/${version}`);
    if (!res.ok) {
      throw new Error(`Package ${locator}@${version} not found on NPM.`);
    }
    const metadata = await res.json();
    
    // Safety check - what is the binary?
    // Often it's npx <package-name>. But let's verify it has a bin or can be run via npx.
    const serverId = locator.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    return {
      serverId,
      sourceType: 'npm',
      locator,
      targetDir: path.join(this.baseDir, serverId),
      version: metadata.version,
      license: metadata.license || 'Unknown',
      integrity: metadata.dist?.integrity || 'Unknown',
      command: 'npx',
      args: ['-y', `${locator}@${metadata.version}`]
    };
  }

  public async executeInstall(plan: InstallPlan): Promise<ServerRecord> {
    audit.log('INSTALL_STARTED', plan.serverId, { plan });
    
    if (fs.existsSync(plan.targetDir)) {
      fs.rmSync(plan.targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(plan.targetDir, { recursive: true });
    
    try {
      // Actually run npm install to cache it locally in the targetDir
      // This isolates dependencies!
      const pkgJson = {
        name: `${plan.serverId}-wrapper`,
        version: "1.0.0",
        dependencies: {
          [plan.locator]: plan.version
        }
      };
      fs.writeFileSync(path.join(plan.targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
      
      await execAsync('bun install', { cwd: plan.targetDir });
      
      const record: ServerRecord = {
        id: plan.serverId,
        name: plan.locator,
        version: plan.version,
        sourceType: plan.sourceType,
        sourceLocator: plan.locator,
        installPath: plan.targetDir,
        command: plan.command, // Usually npx
        args: JSON.stringify(plan.args),
        env: JSON.stringify({}),
        status: 'stopped',
        installedAt: new Date().toISOString()
      };
      
      this.db.upsertServer(record);
      
      audit.log('INSTALL_COMPLETED', plan.serverId, { version: plan.version });
      return record;
      
    } catch (err: any) {
      // Cleanup on failure
      fs.rmSync(plan.targetDir, { recursive: true, force: true });
      audit.log('INSTALL_FAILED', plan.serverId, { error: err.message });
      throw new Error(`Installation failed: ${err.message}`);
    }
  }

  public async uninstall(serverId: string): Promise<void> {
    const record = this.db.getServer(serverId);
    if (!record) throw new Error('Server not found in DB');
    
    if (fs.existsSync(record.installPath)) {
      fs.rmSync(record.installPath, { recursive: true, force: true });
    }
    
    this.db.deleteServer(serverId);
    audit.log('UNINSTALL_COMPLETED', serverId, {});
  }
}
