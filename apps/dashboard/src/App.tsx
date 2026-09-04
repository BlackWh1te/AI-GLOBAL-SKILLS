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

    fetchAdapters();
    fetchAudit();
    
    const interval = setInterval(() => {
      fetchHealth();
      fetchServerStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const startServer = async () => {
    try {
      await fetch(`http://127.0.0.1:3000/api/servers/${SERVER_ID}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'node',
          args: ['-e', 'console.log("Server started"); setInterval(() => console.log("Heartbeat..."), 2000)']
        })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const stopServer = async () => {
    try {
      await fetch(`http://127.0.0.1:3000/api/servers/${SERVER_ID}/stop`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
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

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ borderBottom: '1px solid #ccc', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, color: '#333' }}>Global MCP Control Plane</h1>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>Local Dashboard</p>
      </header>
      
      <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <section style={{ padding: '1.5rem', background: '#f5f5f5', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0 }}>Daemon Status</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              width: '12px', height: '12px', borderRadius: '50%', 
              background: status === 'ready' ? '#10b981' : status === 'checking...' ? '#f59e0b' : '#ef4444' 
            }} />
            <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{status}</span>
            {version && <span style={{ color: '#666' }}>v{version}</span>}
          </div>
          {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>}
        </section>

        <section style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Test Server</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.875rem',
                background: serverState === 'running' ? '#dcfce7' : '#f1f5f9',
                color: serverState === 'running' ? '#166534' : '#475569'
              }}>
                {serverState}
              </span>
              <button 
                onClick={startServer} 
                disabled={serverState === 'running'}
                style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}
              >Start</button>
              <button 
                onClick={stopServer}
                disabled={serverState !== 'running'}
                style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px' }}
              >Stop</button>
            </div>
          </div>
          
          <div style={{ 
            background: '#1e293b', 
            color: '#f8fafc', 
            padding: '1rem', 
            borderRadius: '6px',
            height: '200px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.875rem'
          }}>
            {logs.length === 0 ? <span style={{ color: '#64748b' }}>No logs yet...</span> : logs.map((log, i) => (
              <div key={i}>{log}</div>
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
      </main>
    </div>
  );
}

export default App;
