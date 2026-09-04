import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ClientAdapter {
  id: string;
  name: string;
  isInstalled(): boolean;
  getConfigPath(): string;
  previewConfig(serverId: string, command: string, args: string[], env: Record<string, string>): string;
  applyConfig(serverId: string, command: string, args: string[], env: Record<string, string>): Promise<void>;
}

export class AntigravityAdapter implements ClientAdapter {
  id = 'antigravity';
  name = 'Antigravity AI';

  getConfigPath(): string {
    return path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
  }

  isInstalled(): boolean {
    return fs.existsSync(this.getConfigPath());
  }

  private readConfig(): any {
    const configPath = this.getConfigPath();
    if (!fs.existsSync(configPath)) {
      return { mcpServers: {} };
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  previewConfig(serverId: string, command: string, args: string[], env: Record<string, string> = {}): string {
    const config = this.readConfig();
    
    // Simulate what would be injected
    config.mcpServers = config.mcpServers || {};
    config.mcpServers[serverId] = {
      command,
      args,
      env: Object.keys(env).length > 0 ? env : undefined
    };

    return JSON.stringify(config, null, 2);
  }

  async applyConfig(serverId: string, command: string, args: string[], env: Record<string, string> = {}): Promise<void> {
    const configPath = this.getConfigPath();
    const newConfig = JSON.parse(this.previewConfig(serverId, command, args, env));
    
    // Backup before write
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.bak.${Date.now()}`;
      fs.copyFileSync(configPath, backupPath);
    } else {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
  }
}
