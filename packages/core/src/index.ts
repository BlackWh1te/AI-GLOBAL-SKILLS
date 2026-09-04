import fs from 'fs';
import path from 'path';

export interface AuditEvent {
  timestamp: string;
  action: string;
  targetId: string;
  details: any;
}

export class AuditLogger {
  private logPath: string;

  constructor(baseDir?: string) {
    const dir = baseDir || path.join(process.cwd(), '.global-mcp-data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.logPath = path.join(dir, 'audit.log');
  }

  public log(action: string, targetId: string, details: any = {}) {
    const event: AuditEvent = {
      timestamp: new Date().toISOString(),
      action,
      targetId,
      details
    };
    
    fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n');
  }

  public getHistory(): AuditEvent[] {
    if (!fs.existsSync(this.logPath)) return [];
    
    const content = fs.readFileSync(this.logPath, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line));
  }
}

export * from './db';
