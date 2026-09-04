import fs from 'fs';
import path from 'path';
export class AuditLogger {
    logPath;
    constructor(baseDir) {
        const dir = baseDir || path.join(process.cwd(), '.global-mcp-data');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.logPath = path.join(dir, 'audit.log');
    }
    log(action, targetId, details = {}) {
        const event = {
            timestamp: new Date().toISOString(),
            action,
            targetId,
            details
        };
        fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n');
    }
    getHistory() {
        if (!fs.existsSync(this.logPath))
            return [];
        const content = fs.readFileSync(this.logPath, 'utf8');
        return content
            .split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => JSON.parse(line));
    }
}
export * from './db';
