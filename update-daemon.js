const fs = require('fs');
const path = require('path');
const file = path.join('apps', 'daemon', 'src', 'index.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace("app.use(express.json());", `app.use(express.json({ limit: '100kb' }));

import { randomBytes, createHash } from 'crypto';
const TOKEN_FILE = path.join(os.homedir(), '.gemini', 'config', '.global-mcp-token');
let DAEMON_TOKEN = '';
if (fs.existsSync(TOKEN_FILE)) {
  DAEMON_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
} else {
  DAEMON_TOKEN = randomBytes(32).toString('hex');
  const configDir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, DAEMON_TOKEN, { mode: 0o600 });
}

app.use((req, res, next) => {
  // Allow health and UI without token, but validate Host/Origin
  if (req.headers.host && !['localhost', '127.0.0.1'].some(h => req.headers.host.includes(h))) {
    return res.status(403).json({ error: 'Invalid Host' });
  }
  if (req.headers.origin && !['http://localhost', 'http://127.0.0.1'].some(o => req.headers.origin.startsWith(o))) {
    return res.status(403).json({ error: 'Invalid Origin' });
  }

  // Exempt GET endpoints and OPTIONS
  if (req.method === 'GET' || req.method === 'OPTIONS') return next();

  // Validate Token for mutations
  const auth = req.headers.authorization || '';
  if (auth !== \`Bearer \${DAEMON_TOKEN}\`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

const previewTokens = new Map<string, { oldHash: string, newHash: string, expires: number }>();
`);

content = content.replace("import { DBManager } from '@blackwh1te/core';", `import { DBManager, SecretsManager } from '@blackwh1te/core';`);

content = content.replace(/await pm\.start\(id, command, args \|\| \[\], cwd, env \|\| \{\}\);/, `const resolvedEnv = await SecretsManager.resolveEnv(server.env);
    await pm.start(id, command, args || [], cwd, resolvedEnv);`);
content = content.replace('const { command, args, env, cwd } = req.body;', `const { command, args, env, cwd } = req.body;\n    const server = dbManager.getServer(id);\n    if(!server) return res.status(404).json({error: "Not found"});`);

content = content.replace(/const newEnv = \{ \.\.\.existingEnv \};\s*for \(const key of Object\.keys\(env\)\) \{[\s\S]*?\}\s*server\.env = JSON\.stringify\(newEnv\);/, `
    const newEnv = { ...existingEnv };
    for (const key of Object.keys(env)) {
      if (env[key] !== '********') {
        const ref = await SecretsManager.storeSecret(server.id, key, env[key]);
        newEnv[key] = ref;
      }
    }
    server.env = JSON.stringify(newEnv);
`);

content = content.replace(/res\.json\(\{ oldConfig, newConfig \}\);/, `
    const oldHash = createHash('sha256').update(oldConfig).digest('hex');
    const newHash = createHash('sha256').update(newConfig).digest('hex');
    const token = randomBytes(16).toString('hex');
    previewTokens.set(token, { oldHash, newHash, expires: Date.now() + 60000 });
    res.json({ oldConfig, newConfig, previewToken: token, oldHash, newHash });
`);

content = content.replace(/app\.post\('\/api\/adapters\/:adapterId\/inject', async \(req, res\) => \{[\s\S]*?await adapter\.applyConfig\(serverId, server\.command, args, env\);/, `app.post('/api/adapters/:adapterId/inject', async (req, res) => {
  try {
    const { adapterId } = req.params;
    const { serverId, previewToken, expectedOldHash } = req.body;

    const tokenData = previewTokens.get(previewToken);
    if (!tokenData || Date.now() > tokenData.expires) {
      return res.status(400).json({ error: 'Invalid or expired preview token' });
    }
    if (tokenData.oldHash !== expectedOldHash) {
      return res.status(400).json({ error: 'Hash mismatch' });
    }
    previewTokens.delete(previewToken);

    const adapter = adapters.find(a => a.id === adapterId);
    if (!adapter) return res.status(404).json({ error: 'Adapter not found' });
    
    const server = dbManager.getServer(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    let currentConfig = '{}';
    if (fs.existsSync(adapter.getConfigPath())) {
      currentConfig = fs.readFileSync(adapter.getConfigPath(), 'utf8');
    }
    const currentHash = createHash('sha256').update(currentConfig).digest('hex');
    if (currentHash !== expectedOldHash) {
      return res.status(409).json({ error: 'Config file changed on disk since preview' });
    }

    const args = JSON.parse(server.args || '[]');
    const resolvedEnv = await SecretsManager.resolveEnv(server.env);
    
    await adapter.applyConfig(serverId, server.command, args, resolvedEnv);`);

fs.writeFileSync(file, content);
console.log('Daemon updated.');
