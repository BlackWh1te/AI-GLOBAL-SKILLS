import fs from 'fs';
import path from 'path';

export interface InstallPlan {
  serverId: string;
  sourceType: string;
  locator: string;
  targetDir: string;
}

export class Installer {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), '.global-mcp-data', 'installed');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public plan(serverId: string, sourceType: string, locator: string): InstallPlan {
    return {
      serverId,
      sourceType,
      locator,
      targetDir: path.join(this.baseDir, serverId.replace(/[^a-zA-Z0-9_-]/g, '_'))
    };
  }

  public async execute(plan: InstallPlan): Promise<void> {
    console.log(`Starting installation for ${plan.serverId}...`);
    
    // Create isolated directory
    if (!fs.existsSync(plan.targetDir)) {
      fs.mkdirSync(plan.targetDir, { recursive: true });
    }

    if (plan.sourceType === 'marketplace' || plan.sourceType === 'npm') {
      // Simulate npm/npx or direct download for fixture
      console.log(`Simulating install from ${plan.locator} into ${plan.targetDir}`);
      
      const lockData = {
        installedAt: new Date().toISOString(),
        version: "latest",
        locator: plan.locator,
        executable: "npx",
        args: ["-y", plan.locator]
      };
      
      fs.writeFileSync(
        path.join(plan.targetDir, 'mcp-lock.json'),
        JSON.stringify(lockData, null, 2)
      );
    } else {
      throw new Error(`Unsupported source type: ${plan.sourceType}`);
    }

    console.log(`Successfully installed ${plan.serverId}.`);
  }
}
