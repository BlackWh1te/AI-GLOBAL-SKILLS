import fs from 'fs';
import path from 'path';
import os from 'os';
import { AuditLogger } from '@BlackWh1te/core';

const audit = new AuditLogger();

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
    return fs.existsSync(path.join(os.homedir(), '.gemini'));
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
    
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, `${configPath}.bak.${Date.now()}`);
    } else {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    
    audit.log('CONFIG_INJECTED', serverId, { adapter: this.id, path: configPath });
  }
}

export class CursorAdapter extends AntigravityAdapter {
  id = 'cursor';
  name = 'Cursor IDE';
  getConfigPath(): string {
    return path.join(os.homedir(), '.cursor', 'mcp.json');
  }
  isInstalled(): boolean {
    return fs.existsSync(path.join(os.homedir(), '.cursor'));
  }
}

export class WindsurfAdapter extends AntigravityAdapter {
  id = 'windsurf';
  name = 'Windsurf IDE';
  getConfigPath(): string {
    return path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
  }
  isInstalled(): boolean {
    return fs.existsSync(path.join(os.homedir(), '.codeium', 'windsurf'));
  }
}

export class ClaudeDesktopAdapter extends AntigravityAdapter {
  id = 'claude-desktop';
  name = 'Claude Desktop';
  getConfigPath(): string {
    return process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json')
      : path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  isInstalled(): boolean {
    return fs.existsSync(path.dirname(this.getConfigPath()));
  }
}

export class VsCodeClineAdapter extends AntigravityAdapter {
  id = 'vscode-cline';
  name = 'VS Code (Cline/Roo)';
  getConfigPath(): string {
    return process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json')
      : path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json');
  }
  isInstalled(): boolean {
    return fs.existsSync(path.dirname(path.dirname(this.getConfigPath()))); // check if extension dir exists
  }
}

export class ClaudeCodeCliAdapter extends AntigravityAdapter {
  id = 'claude-code-cli';
  name = 'Claude Code CLI';
  getConfigPath(): string {
    // Claude CLI config path
    return path.join(os.homedir(), '.claude.json');
  }
  isInstalled(): boolean {
    // Assume installed if config file exists, or if a .claude folder exists
    return fs.existsSync(this.getConfigPath()) || fs.existsSync(path.join(os.homedir(), '.claude'));
  }
}

export const adapters = [
  new AntigravityAdapter(),
  new CursorAdapter(),
  new WindsurfAdapter(),
  new ClaudeDesktopAdapter(),
  new VsCodeClineAdapter(),
  new ClaudeCodeCliAdapter()
];
