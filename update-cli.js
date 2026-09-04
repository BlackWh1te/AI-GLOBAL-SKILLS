const fs = require('fs');
const path = require('path');
const file = path.join('apps', 'cli', 'src', 'index.ts');
let content = fs.readFileSync(file, 'utf8');

// Add token reading to fetchApi
content = content.replace(/async function fetchApi\(path: string, options\?: RequestInit\) \{/, `async function fetchApi(apiPath: string, options?: RequestInit) {
  const os = require('os');
  const fs = require('fs');
  const p = require('path');
  const tokenFile = p.join(os.homedir(), '.gemini', 'config', '.global-mcp-token');
  let token = '';
  if (fs.existsSync(tokenFile)) token = fs.readFileSync(tokenFile, 'utf8').trim();
  
  options = options || {};
  options.headers = {
    ...options.headers,
    'Authorization': \`Bearer \${token}\`
  };
`);
content = content.replace(/await fetch\(\\\`\$\{API_BASE\}\$\{path\}\\\`\, options\)/g, "await fetch(`${API_BASE}${apiPath}`, options)");

// Fix configure command
content = content.replace(/const preview = await fetchApi\(\\\`\/adapters\/\$\{client\}\/preview\\\`[\s\S]*?console\.log\('Configuration applied successfully\.'\);\n  \}\);/, `const preview = await fetchApi(\`/adapters/\${client}/preview\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId })
    });
    
    // Instead of raw config, show diff? We can just show diff if daemon sent it, but wait, daemon only sends old and new config, diff wasn't generated in daemon yet! Wait, I'll update daemon to generate unified diff. Let's assume preview.diff text is returned.
    console.log('--- Configuration Diff ---');
    console.log(preview.diff || 'No diff available');
    
    if (!options.yes) {
      const ans = prompt('Apply configuration? (y/n) ');
      if (ans?.toLowerCase() !== 'y') {
         console.log('Aborted.');
         return;
      }
    }
    
    await fetchApi(\`/adapters/\${client}/inject\`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ serverId, previewToken: preview.previewToken, expectedOldHash: preview.oldHash })
    });
    console.log('Configuration applied successfully.');
  });`);

// Fix env:set
content = content.replace(/program\.command\('env:set <server-id> <key> <value>'\)[\s\S]*?console\.log\\\(\\\`Set \$\{key\} securely for \$\{serverId\}\.\\\`\\\);\n  \}\);/, `import { password } from '@inquirer/prompts';
program.command('env:set <server-id> <key>')
  .description('Set an environment variable securely')
  .action(async (serverId, key) => {
    const servers = await fetchApi('/registry/servers');
    const srv = servers.find((s: any) => s.id === serverId);
    if (!srv) {
       console.error('Server not found');
       process.exit(1);
    }
    
    const value = await password({ message: \`Enter secure value for \${key}:\` });
    
    const envDelta = { [key]: value };
    await fetchApi(\`/registry/servers/\${serverId}/env\`, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ env: envDelta })
    });
    console.log(\`Set \${key} securely for \${serverId}.\`);
  });`);

fs.writeFileSync(file, content);
console.log('CLI updated');
