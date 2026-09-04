const fs = require('fs');
const path = require('path');
const file = path.join('apps', 'dashboard', 'src', 'App.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const \[status, setStatus\] = useState<string>\('checking\.\.\.'\);/, `const [status, setStatus] = useState<string>('checking...');
  const [token, setToken] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) { localStorage.setItem('mcp_token', t); window.history.replaceState({}, '', window.location.pathname); return t; }
    return localStorage.getItem('mcp_token') || '';
  });
`);

content = content.replace(/useEffect\(\(\) => \{/, `const authFetch = async (url: string, options?: RequestInit) => {
    const headers = { ...options?.headers, 'Authorization': \`Bearer \${token}\` };
    return fetch(url, { ...options, headers });
  };
  
  useEffect(() => {`);

// replace fetch with authFetch
content = content.replace(/fetch\('http:\/\/127\.0\.0\.1:3000\/api\/adapters\/(\$\{.*?\})\/preview'/g, "authFetch(`http://127.0.0.1:3000/api/adapters/$1/preview`");
content = content.replace(/fetch\('http:\/\/127\.0\.0\.1:3000\/api\/adapters\/(\$\{.*?\})\/inject'/g, "authFetch(`http://127.0.0.1:3000/api/adapters/$1/inject`");
content = content.replace(/fetch\('http:\/\/127\.0\.0\.1:3000\/api\/registry\/servers\/(\$\{.*?\})\/env'/g, "authFetch(`http://127.0.0.1:3000/api/registry/servers/$1/env`");
content = content.replace(/fetch\(\`http:\/\/127\.0\.0\.1:3000\/api\/servers\/\$\{id\}\/start\`/g, "authFetch(`http://127.0.0.1:3000/api/servers/${id}/start`");
content = content.replace(/fetch\(\`http:\/\/127\.0\.0\.1:3000\/api\/servers\/\$\{id\}\/stop\`/g, "authFetch(`http://127.0.0.1:3000/api/servers/${id}/stop`");
content = content.replace(/fetch\(\`http:\/\/127\.0\.0\.1:3000\/api\/registry\/servers\/\$\{id\}\`/g, "authFetch(`http://127.0.0.1:3000/api/registry/servers/${id}`");
content = content.replace(/fetch\('http:\/\/127\.0\.0\.1:3000\/api\/registry\/install\/plan'/g, "authFetch('http://127.0.0.1:3000/api/registry/install/plan'");
content = content.replace(/fetch\('http:\/\/127\.0\.0\.1:3000\/api\/registry\/install'/g, "authFetch('http://127.0.0.1:3000/api/registry/install'");

content = content.replace(/const \[previewData, setPreviewData\] = useState[\s\S]*?\| null>\(null\);/, `const [previewData, setPreviewData] = useState<any>(null);
  const [selectedServerId, setSelectedServerId] = useState<string>('');`);

content = content.replace(/const previewConfig = async \([\s\S]*?\}\n  \};\n/m, `const previewConfig = async (adapterId: string) => {
    if(!selectedServerId) return alert('Select a server first');
    try {
      const res = await authFetch(\`http://127.0.0.1:3000/api/adapters/\${adapterId}/preview\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: selectedServerId })
      });
      const data = await res.json();
      if(res.ok) {
        setPreviewData({ adapterId, serverId: selectedServerId, diff: data.diff, token: data.previewToken, hash: data.oldHash });
      } else {
        alert(data.error);
      }
    } catch(e) {
      alert('Error previewing config');
    }
  };
`);

content = content.replace(/body: JSON\.stringify\(\{ serverId: previewData\.serverId \}\)/, "body: JSON.stringify({ serverId: previewData.serverId, previewToken: previewData.token, expectedOldHash: previewData.hash })");

content = content.replace(/onClick=\{\(\) => previewConfig\(adapter\.id, installedServers\[0\]\?\.id \|\| 'test-server'\)\}/, `onClick={() => previewConfig(adapter.id)} disabled={!selectedServerId}`);

content = content.replace(/<p style=\{\{ color: '#666', marginBottom: '1rem' \}\}>Install this MCP server directly into your local IDEs\.<\/p>/, `<p style={{ color: '#666', marginBottom: '1rem' }}>Install this MCP server directly into your local IDEs.</p>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 'bold', marginRight: '1rem' }}>Target Server:</label>
            <select value={selectedServerId} onChange={e => setSelectedServerId(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px' }}>
              <option value="">-- Select a Server --</option>
              {installedServers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>`);

content = content.replace(/<div style=\{\{ flex: 1 \}\}>[\s\S]*?<\/div>\s*<div style=\{\{ flex: 1 \}\}>[\s\S]*?<\/div>/, `<div style={{ flex: 1 }}>
                <h3>Unified Diff</h3>
                <pre style={{ background: '#f8fafc', padding: '1rem', fontSize: '0.8rem', overflowX: 'auto', whiteSpace: 'pre-wrap', border: '1px solid #e2e8f0', borderRadius: '4px' }}>{previewData.diff}</pre>
              </div>`);

fs.writeFileSync(file, content);
console.log('App.tsx updated');
