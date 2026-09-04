import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState<string>('checking...');
  const [version, setVersion] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const [serverState, setServerState] = useState<string>('stopped');
  const [logs, setLogs] = useState<string[]>([]);
  
  const SERVER_ID = 'test-server';

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
      </main>
    </div>
  );
}

export default App;
