import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState<string>('checking...');
  const [version, setVersion] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const [serverState, setServerState] = useState<string>('stopped');
  const [logs, setLogs] = useState<string[]>([]);
  
  const SERVER_ID = 'test-server';
  
  const [adapters, setAdapters] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'servers' | 'marketplace'>('servers');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{local: any[], npm: any[]}>({local: [], npm: []});
  const [isSearching, setIsSearching] = useState(false);
  const [installPlan, setInstallPlan] = useState<any | null>(null);
  const [installedServers, setInstalledServers] = useState<any[]>([]);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('http://127.0.0.1:3000/api/health');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setStatus(data.status);
        setVersion(data.version);
        setError('');
      } catch (err) {
        setStatus('offline');
        setError(err instanceof Error ? err.message : 'Failed to connect to daemon');
      }
    };

    const fetchServerStatus = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:3000/api/servers/${SERVER_ID}/status`);
        if (res.ok) {
          const data = await res.json();
          setServerState(data.state);
        }
        
        const logsRes = await fetch(`http://127.0.0.1:3000/api/servers/${SERVER_ID}/logs`);
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setLogs(logsData.logs);
        }
      } catch (err) {
        // Ignore if daemon is offline
      }
    };

    fetchHealth();
    fetchServerStatus();
    
    const fetchAdapters = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3000/api/adapters');
        if (res.ok) setAdapters(await res.json());
      } catch (e) {}
    };

    const fetchAudit = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3000/api/audit');
        if (res.ok) setAuditLogs(await res.json());
      } catch (e) {}
    };

    const fetchServers = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3000/api/registry/servers');
        if (res.ok) setInstalledServers(await res.json());
      } catch (e) {}
    };

    fetchAdapters();
    fetchAudit();
    fetchServers();
    
    const interval = setInterval(() => {
      fetchHealth();
      fetchServerStatus();
      fetchServers();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const startServer = async (id: string, command: string, args: string, env: string, path: string) => {
    try {
      await fetch(`http://127.0.0.1:3000/api/servers/${id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, args: JSON.parse(args), env: JSON.parse(env || '{}'), cwd: path })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const stopServer = async (id: string) => {
    try {
      await fetch(`http://127.0.0.1:3000/api/servers/${id}/stop`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  const uninstallServer = async (id: string) => {
    if(!confirm('Uninstall server?')) return;
    try {
      await fetch(`http://127.0.0.1:3000/api/registry/servers/${id}`, { method: 'DELETE' });
    } catch(e) {}
  };

  const injectConfig = async (adapterId: string) => {
    try {
      await fetch(`http://127.0.0.1:3000/api/adapters/${adapterId}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: SERVER_ID,
          command: 'node',
          args: ['-e', 'console.log("Server started")']
        })
      });
      alert('Injected into ' + adapterId);
    } catch (err) {
      alert('Error injecting');
    }
  };

  const rollbackConfig = async (adapterId: string) => {
    if (!confirm('Are you sure you want to restore the last backup for this IDE?')) return;
    try {
      const res = await fetch(`http://127.0.0.1:3000/api/adapters/${adapterId}/rollback`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Restored successfully from ' + data.restoredFrom);
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (err) {
      alert('Error rolling back');
    }
  };

  const searchRegistry = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    try {
      const res = await fetch(`http://127.0.0.1:3000/api/registry/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const planInstall = async (locator: string, version: string = 'latest') => {
    try {
      const res = await fetch('http://127.0.0.1:3000/api/registry/install/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locator, version })
      });
      const plan = await res.json();
      setInstallPlan(plan);
    } catch (err) {
      alert('Failed to plan installation');
    }
  };

  const executeInstall = async () => {
    if (!installPlan) return;
    try {
      await fetch('http://127.0.0.1:3000/api/registry/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: installPlan })
      });
      setInstallPlan(null);
      alert('Installed successfully!');
    } catch (err) {
      alert('Installation failed');
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ borderBottom: '1px solid #ccc', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, color: '#333' }}>Global MCP Control Plane</h1>
          <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>Local Dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setActiveTab('servers')}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'servers' ? '#333' : '#e5e5e5', color: activeTab === 'servers' ? 'white' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >My Servers</button>
          <button 
            onClick={() => setActiveTab('marketplace')}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'marketplace' ? '#3b82f6' : '#e5e5e5', color: activeTab === 'marketplace' ? 'white' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >Discover MCPs</button>
        </div>
      </header>
      
      <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {activeTab === 'servers' && (
          <>
            <section style={{ padding: '1.5rem', background: '#f5f5f5', borderRadius: '8px' }}>
              <h2 style={{ marginTop: 0 }}>Daemon Status</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '12px', height: '12px', borderRadius: '50%', 
                  background: status === 'ready' ? '#10b981' : '#ef4444' 
                }}></div>
                <span style={{ fontWeight: 'bold' }}>{status === 'ready' ? 'Online' : 'Offline'}</span>
                {version && <span style={{ color: '#666' }}>v{version}</span>}
              </div>
            </section>

            <section style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
              <h2 style={{ marginTop: 0 }}>Installed Servers</h2>
              {installedServers.length === 0 && <p style={{ color: '#666' }}>No servers installed yet. Go to Discover MCPs to find some.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {installedServers.map(server => (
                  <div key={server.id} style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{server.name} <span style={{fontSize:'0.8em', color:'#666'}}>v{server.version}</span></div>
                      <div>
                        {server.status === 'running' ? (
                          <button onClick={() => stopServer(server.id)} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Stop</button>
                        ) : (
                          <button onClick={() => startServer(server.id, server.command, server.args, server.env, server.installPath)} style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Start</button>
                        )}
                        <button onClick={() => uninstallServer(server.id)} style={{ marginLeft: '0.5rem', padding: '0.5rem 1rem', background: '#64748b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Uninstall</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

        <section style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0 }}>IDE Integration</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>Install this MCP server directly into your local IDEs.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {adapters.map(adapter => (
              <div key={adapter.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{adapter.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{adapter.configPath}</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: adapter.installed ? '#10b981' : '#94a3b8' }}>
                    {adapter.installed ? 'Installed' : 'Not found'}
                  </span>
                  <button 
                    onClick={() => injectConfig(adapter.id)}
                    style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#333', color: 'white', border: 'none', borderRadius: '4px' }}
                  >Inject Config</button>
                  <button 
                    onClick={() => rollbackConfig(adapter.id)}
                    style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px' }}
                  >Undo</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0 }}>Audit History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
            {auditLogs.slice().reverse().map((log, i) => (
              <div key={i} style={{ padding: '0.5rem', borderBottom: '1px solid #eee', fontSize: '0.875rem' }}>
                <span style={{ color: '#666', marginRight: '1rem' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>{log.action}</span>
                <span style={{ color: '#0369a1' }}>{log.details?.adapter || log.targetId}</span>
              </div>
            ))}
            {auditLogs.length === 0 && <span style={{ color: '#999' }}>No history yet</span>}
          </div>
        </section>
          </>
        )}

        {activeTab === 'marketplace' && (
          <section style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
            <h2 style={{ marginTop: 0 }}>Discover MCP Servers</h2>
            <form onSubmit={searchRegistry} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search local registry and NPM..." 
                style={{ flex: 1, padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <button 
                type="submit" 
                disabled={isSearching}
                style={{ padding: '0.75rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {searchResults.local.length > 0 && <h3>From Global Skills Registry</h3>}
              {searchResults.local.map((pkg, i) => (
                <div key={'local'+i} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>{pkg.name}</div>
                  <div style={{ color: '#64748b', margin: '0.5rem 0' }}>{pkg.summary}</div>
                  <div style={{ fontSize: '0.875rem' }}>Source: {pkg.source.locator}</div>
                </div>
              ))}

              {searchResults.npm.length > 0 && <h3 style={{ marginTop: '1rem' }}>From NPM Registry</h3>}
              {searchResults.npm.map((pkg, i) => (
                <div key={'npm'+i} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>{pkg.name} <span style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 'normal' }}>v{pkg.version}</span></span>
                      <div style={{ color: '#64748b', margin: '0.5rem 0' }}>{pkg.description}</div>
                      <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Author: {pkg.author} | <a href={pkg.links.npm} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>NPM</a></div>
                    </div>
                    <button 
                      onClick={() => planInstall(pkg.name, pkg.version)}
                      style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >Install</button>
                  </div>
                </div>
              ))}
              
              {installPlan && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '100%' }}>
                    <h2 style={{marginTop: 0}}>Confirm Installation</h2>
                    <p><strong>Package:</strong> {installPlan.locator}@{installPlan.version}</p>
                    <p><strong>License:</strong> {installPlan.license}</p>
                    <p><strong>Target:</strong> {installPlan.targetDir}</p>
                    <p>This package will be installed locally in an isolated environment.</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                      <button onClick={() => setInstallPlan(null)} style={{ padding: '0.5rem 1rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={executeInstall} style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Approve & Install</button>
                    </div>
                  </div>
                </div>
              )}
              
              {!isSearching && searchResults.local.length === 0 && searchResults.npm.length === 0 && searchQuery && (
                <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>No servers found for "{searchQuery}"</div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
