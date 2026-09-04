import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState<string>('checking...');
  const [version, setVersion] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('http://127.0.0.1:3000/api/health');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setStatus(data.status);
        setVersion(data.version);
      } catch (err) {
        setStatus('offline');
        setError(err instanceof Error ? err.message : 'Failed to connect to daemon');
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ borderBottom: '1px solid #ccc', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, color: '#333' }}>Global MCP Control Plane</h1>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>Local Dashboard</p>
      </header>
      
      <main>
        <section style={{ padding: '1.5rem', background: '#f5f5f5', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0 }}>Daemon Status</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              background: status === 'ready' ? '#10b981' : status === 'checking...' ? '#f59e0b' : '#ef4444' 
            }} />
            <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{status}</span>
            {version && <span style={{ color: '#666' }}>v{version}</span>}
          </div>
          {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>}
        </section>
      </main>
    </div>
  );
}

export default App;
