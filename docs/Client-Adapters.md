# Building Client Adapters

Client Adapters are the magic bridge between the **Global MCP Control Plane** and your favorite AI IDEs (like Cursor, Windsurf, or Antigravity). When you install a server through the Control Plane, these adapters automatically configure your IDE to start using it.

## The Interface
Every adapter in `packages/client-adapters` must implement the `ClientAdapter` interface:

```typescript
export interface ClientAdapter {
  id: string;
  name: string;
  isInstalled(): boolean;
  getConfigPath(): string;
  previewConfig(serverId: string, command: string, args: string[], env: Record<string, string>): string;
  applyConfig(serverId: string, command: string, args: string[], env: Record<string, string>): Promise<void>;
}
```

## Rules for Adapters
1. **Never Overwrite Blindly**: Always parse the existing configuration and inject your changes cleanly.
2. **Backups**: You MUST write a backup (e.g., `config.json.bak`) before modifying the user's IDE configuration.
3. **Atomic Writes**: Write to a temporary file and rename it to prevent corruption if the process crashes.
