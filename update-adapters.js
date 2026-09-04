const fs = require('fs');
const path = require('path');
const file = path.join('packages', 'client-adapters', 'src', 'index.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/async applyConfig\([\s\S]*?\}\n\}/, `async applyConfig(serverId: string, command: string, args: string[], env: Record<string, string> = {}): Promise<void> {
    const configPath = this.getConfigPath();
    const newConfigStr = this.previewConfig(serverId, command, args, env);
    
    // Safety 1: Validate JSON before writing
    let newConfig;
    try {
      newConfig = JSON.parse(newConfigStr);
    } catch(e) {
      throw new Error('Generated config is invalid JSON');
    }

    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Safety 2: Normalize and validate paths
    // If configPath exists, ensure it resolves inside expected directory
    if (fs.existsSync(configPath)) {
      const realPath = fs.realpathSync(configPath);
      const realDir = fs.realpathSync(dir);
      if (!realPath.startsWith(realDir)) {
         throw new Error('Path traversal or symlink attack detected');
      }
    }

    // Safety 3: Atomic write via tmp file
    const tmpPath = path.join(dir, \`.\${path.basename(configPath)}.tmp.\${Date.now()}\`);
    fs.writeFileSync(tmpPath, JSON.stringify(newConfig, null, 2), { mode: 0o600 });
    
    // Safety 4: Backup existing
    if (fs.existsSync(configPath)) {
      const backupPath = \`\${configPath}.bak.\${Date.now()}\`;
      fs.copyFileSync(configPath, backupPath);
    }

    // Safety 5: Atomic rename
    fs.renameSync(tmpPath, configPath);
    
    audit.log('CONFIG_INJECTED', serverId, { adapter: this.id, path: configPath });
  }
}`);

fs.writeFileSync(file, content);
console.log('client-adapters updated');
