import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';
export class DBManager {
    db;
    constructor(dbPath) {
        const dir = dbPath ? path.dirname(dbPath) : path.join(process.cwd(), '.global-mcp-data');
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        this.db = new Database(dbPath || path.join(dir, 'state.sqlite'), { create: true });
        this.initSchema();
    }
    initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        sourceType TEXT NOT NULL,
        sourceLocator TEXT NOT NULL,
        installPath TEXT NOT NULL,
        command TEXT NOT NULL,
        args TEXT NOT NULL,
        env TEXT NOT NULL,
        status TEXT NOT NULL,
        installedAt TEXT NOT NULL
      );
    `);
    }
    getServers() {
        return this.db.query('SELECT * FROM servers').all();
    }
    getServer(id) {
        const res = this.db.query('SELECT * FROM servers WHERE id = $id').get({ $id: id });
        return res || null;
    }
    upsertServer(server) {
        const stmt = this.db.prepare(`
      INSERT INTO servers (id, name, version, sourceType, sourceLocator, installPath, command, args, env, status, installedAt)
      VALUES ($id, $name, $version, $sourceType, $sourceLocator, $installPath, $command, $args, $env, $status, $installedAt)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        version=excluded.version,
        sourceType=excluded.sourceType,
        sourceLocator=excluded.sourceLocator,
        installPath=excluded.installPath,
        command=excluded.command,
        args=excluded.args,
        env=excluded.env,
        status=excluded.status
    `);
        stmt.run({
            $id: server.id,
            $name: server.name,
            $version: server.version,
            $sourceType: server.sourceType,
            $sourceLocator: server.sourceLocator,
            $installPath: server.installPath,
            $command: server.command,
            $args: server.args,
            $env: server.env,
            $status: server.status,
            $installedAt: server.installedAt
        });
    }
    deleteServer(id) {
        this.db.query('DELETE FROM servers WHERE id = $id').run({ $id: id });
    }
}
