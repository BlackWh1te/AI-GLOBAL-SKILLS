import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { DBManager, ServerRecord } from '@blackwh1te/core';
import { AuditLogger } from '@blackwh1te/core';

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
  binaries: string[];
  lifecycleScripts: string[];
  dependencies: string[];
  riskAnalysis: string;
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
    // 1. Validate and normalize the package name
    if (!/^[a-zA-Z0-9@./_-]+$/.test(locator)) {
      throw new Error('Invalid package name format');
    }
    const safeLocator = locator.toLowerCase();

    // 2. Query package metadata safely
    const res = await fetch(`https://registry.npmjs.org/${safeLocator}`);
    if (!res.ok) {
      throw new Error(`Package ${safeLocator} not found on NPM.`);
    }
    const data = await res.json();
    
    // 3. Resolve an exact immutable version
    const exactVersion = data['dist-tags']?.[version] || version;
    const metadata = data.versions[exactVersion];
    if (!metadata) {
      throw new Error(`Version ${exactVersion} not found for package ${safeLocator}`);
    }

    const serverId = safeLocator.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // 8. Inspect binaries & scripts
    const binaries = metadata.bin ? (typeof metadata.bin === 'string' ? [metadata.bin] : Object.keys(metadata.bin)) : [];
    const scripts = metadata.scripts ? Object.keys(metadata.scripts).filter(s => ['preinstall', 'install', 'postinstall'].includes(s)) : [];

    let riskAnalysis = 'Low';
    if (scripts.length > 0) riskAnalysis = 'High (Executes arbitrary lifecycle scripts)';
    else if (metadata.dependencies && Object.keys(metadata.dependencies).length > 50) riskAnalysis = 'Medium (Many dependencies)';

    return {
      serverId,
      sourceType: 'npm',
      locator: safeLocator,
      targetDir: path.join(this.baseDir, serverId),
      version: exactVersion,
      license: metadata.license || 'Unknown',
      integrity: metadata.dist?.integrity || 'Unknown',
      command: 'npx',
      args: ['-y', `${safeLocator}@${exactVersion}`],
      binaries,
      lifecycleScripts: scripts,
      dependencies: Object.keys(metadata.dependencies || {}),
      riskAnalysis
    };
  }

  public async executeInstall(plan: InstallPlan, approveScripts: boolean = false): Promise<ServerRecord> {
    audit.log('INSTALL_STARTED', plan.serverId, { plan });
    
    // 9. Block lifecycle scripts by default, 10. require explicit approval
    if (plan.lifecycleScripts.length > 0 && !approveScripts) {
      const err = `Installation blocked: package contains lifecycle scripts (${plan.lifecycleScripts.join(', ')}). Explicit approval required.`;
      audit.log('INSTALL_FAILED', plan.serverId, { error: err });
      throw new Error(err);
    }
    
    // 13. Use a temporary staging directory
    const stagingDir = path.join(this.baseDir, `.staging-${plan.serverId}-${Date.now()}`);
    fs.mkdirSync(stagingDir, { recursive: true });
    
    try {
      const pkgJson = {
        name: `${plan.serverId}-wrapper`,
        version: "1.0.0",
        dependencies: {
          [plan.locator]: plan.version
        }
      };
      fs.writeFileSync(path.join(stagingDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
      
      // 11. Execute processes with argument arrays and shell: false
      const { spawn } = require('child_process');
      const args = ['install'];
      if (!approveScripts) args.push('--ignore-scripts');
      
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('bun', args, { cwd: stagingDir, shell: false });
        proc.on('close', (code: number | null) => {
          if (code === 0) resolve();
          else reject(new Error(`bun install exited with code ${code}`));
        });
      });
      
      // 14. Commit database state only after validation succeeds
      if (fs.existsSync(plan.targetDir)) {
        fs.rmSync(plan.targetDir, { recursive: true, force: true });
      }
      // 12. install into a unique managed directory
      fs.renameSync(stagingDir, plan.targetDir);
      
      // 16. never expose environment secrets
      const record: ServerRecord = {
        id: plan.serverId,
        name: plan.locator,
        version: plan.version,
        sourceType: plan.sourceType,
        sourceLocator: plan.locator,
        installPath: plan.targetDir,
        command: plan.command, 
        args: JSON.stringify(plan.args),
        env: JSON.stringify({}), // Do not log secrets
        status: 'stopped',
        installedAt: new Date().toISOString()
      };
      
      this.db.upsertServer(record);
      
      audit.log('INSTALL_COMPLETED', plan.serverId, { version: plan.version });
      return record;
      
    } catch (err: any) {
      // 15. Remove partial files and revert state after failure
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
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
