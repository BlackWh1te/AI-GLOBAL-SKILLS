const fs = require('fs');
const path = require('path');
const file = path.join('apps', 'dashboard', 'src', 'App.tsx');
let content = fs.readFileSync(file, 'utf8');

// replace injectConfig
content = content.replace(/const injectConfig = async.*?^\s*\};/ms, `
  const [previewData, setPreviewData] = useState<{adapterId: string, serverId: string, old: string, new: string} | null>(null);

  const previewConfig = async (adapterId: string, serverId: string) => {
    try {
      const res = await fetch(\`http://127.0.0.1:3000/api/adapters/\${adapterId}/preview\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId })
      });
      const data = await res.json();
      if(res.ok) {
        setPreviewData({ adapterId, serverId, old: data.oldConfig, new: data.newConfig });
      } else {
        alert(data.error);
      }
    } catch(e) {
      alert('Error previewing config');
    }
  };

  const confirmInject = async () => {
    if(!previewData) return;
    try {
      await fetch(\`http://127.0.0.1:3000/api/adapters/\${previewData.adapterId}/inject\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: previewData.serverId })
      });
      alert('Injected successfully');
      setPreviewData(null);
    } catch(e) {
      alert('Error injecting');
    }
  };

  const updateEnv = async (serverId: string, key: string, val: string) => {
     try {
       await fetch(\`http://127.0.0.1:3000/api/registry/servers/\${serverId}/env\`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ env: { [key]: val } })
       });
       alert('Environment updated securely');
     } catch(e) {}
  };
`);

// fix hardcoded IDE inject button
content = content.replace(/<button[^>]*onClick=\{\(\) => injectConfig\(adapter\.id\)\}.*?<\/button>/ms, `
<button 
  onClick={() => previewConfig(adapter.id, installedServers[0]?.id || 'test-server')}
  style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#333', color: 'white', border: 'none', borderRadius: '4px' }}
>Preview & Inject</button>
`);

// Add env rendering
content = content.replace(/<button onClick=\{\(\) => uninstallServer\(server\.id\)\}.*?<\/button>/ms, `$&
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Environment Variables (Secrets Redacted)</div>
                      {Object.keys(JSON.parse(server.env || '{}')).length === 0 ? <div style={{fontSize:'0.8rem', color:'#666'}}>No variables configured.</div> : null}
                      {Object.entries(JSON.parse(server.env || '{}')).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input type="text" readOnly value={k} style={{ padding: '0.25rem', width: '120px' }} />
                          <input type="text" 
                                 placeholder="Enter new value to update"
                                 defaultValue={v as string} 
                                 onBlur={e => { if(e.target.value && e.target.value !== v) updateEnv(server.id, k, e.target.value); }}
                                 style={{ padding: '0.25rem', flex: 1 }} />
                        </div>
                      ))}
`);

// add modal for preview at the end
content = content.replace(/<\/div>\s*\)\;\s*\}\s*export default App;/ms, `
      {previewData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '80%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>Review Configuration Changes</h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h3>Current Config</h3>
                <pre style={{ background: '#f5f5f5', padding: '1rem', fontSize: '0.8rem', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{previewData.old}</pre>
              </div>
              <div style={{ flex: 1 }}>
                <h3>New Config</h3>
                <pre style={{ background: '#f0fdf4', padding: '1rem', fontSize: '0.8rem', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{previewData.new}</pre>
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setPreviewData(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              <button onClick={confirmInject} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}>Confirm Inject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
`);

fs.writeFileSync(file, content);
console.log('App.tsx updated');
