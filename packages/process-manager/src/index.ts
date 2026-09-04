import { spawn, ChildProcess } from 'child_process';
import treeKill from 'tree-kill';

export type ProcessState = 'stopped' | 'starting' | 'running' | 'crashed';

export interface ProcessStatus {
  id: string;
  state: ProcessState;
  uptime: number;
  cpu: number;
  memory: number;
}

export class ProcessManager {
  private processes = new Map<string, ChildProcess>();
  private states = new Map<string, ProcessState>();
  private logs = new Map<string, string[]>();
  private startTimes = new Map<string, number>();

  public async start(id: string, command: string, args: string[], cwd?: string, env?: Record<string, string>): Promise<void> {
    if (this.states.get(id) === 'running') {
      throw new Error(`Process ${id} is already running.`);
    }

    this.states.set(id, 'starting');
    this.logs.set(id, []);
    this.startTimes.set(id, Date.now());

    const child = spawn(command, args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false // Important for graceful shutdown
    });

    this.processes.set(id, child);

    child.stdout?.on('data', (data) => {
      this.appendLog(id, data.toString());
    });

    child.stderr?.on('data', (data) => {
      this.appendLog(id, `[ERROR] ${data.toString()}`);
    });

    child.on('spawn', () => {
      this.states.set(id, 'running');
    });

    child.on('error', (err) => {
      this.appendLog(id, `[SYSTEM ERROR] ${err.message}`);
      this.states.set(id, 'crashed');
    });

    child.on('exit', (code) => {
      this.appendLog(id, `[SYSTEM] Process exited with code ${code}`);
      this.states.set(id, code === 0 ? 'stopped' : 'crashed');
      this.processes.delete(id);
    });
  }

  public async stop(id: string): Promise<void> {
    const child = this.processes.get(id);
    if (!child || !child.pid) {
      this.states.set(id, 'stopped');
      return;
    }

    return new Promise((resolve, reject) => {
      treeKill(child.pid as number, 'SIGTERM', (err) => {
        if (err) {
          reject(err);
        } else {
          this.states.set(id, 'stopped');
          this.processes.delete(id);
          resolve();
        }
      });
    });
  }

  private appendLog(id: string, text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const currentLogs = this.logs.get(id) || [];
    currentLogs.push(...lines);
    
    // Keep only last 500 lines to prevent memory leaks
    if (currentLogs.length > 500) {
      currentLogs.splice(0, currentLogs.length - 500);
    }
  }

  public getLogs(id: string): string[] {
    return this.logs.get(id) || [];
  }

  public getStatus(id: string): ProcessStatus {
    const state = this.states.get(id) || 'stopped';
    const startTime = this.startTimes.get(id) || 0;
    
    return {
      id,
      state,
      uptime: state === 'running' ? Math.floor((Date.now() - startTime) / 1000) : 0,
      cpu: 0, // Mock for now, will implement proper usage stats later
      memory: 0
    };
  }
}
