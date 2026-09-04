# Adding an MCP Server

The Global MCP Control Plane relies on a centralized catalog to know what servers are available for installation.

## Step 1: Open the Registry
Navigate to `registries/catalog.json` in the project root.

## Step 2: Add your JSON Entry
Add your MCP server definition into the `components` array:

```json
{
  "id": "my-cool-server",
  "name": "Cool Server API",
  "kind": "tool",
  "summary": "This server lets the AI do cool things.",
  "capabilities": ["database", "cool-stuff"],
  "keywords": ["cool", "database", "api"],
  "platforms": ["cursor", "antigravity"],
  "source": {
    "type": "npm",
    "locator": "@my-org/cool-mcp-server"
  },
  "install": {
    "mode": "npx",
    "requires_confirmation": true
  },
  "risk": "medium",
  "status": "community"
}
```

## Step 3: Test
Run `bun run test` in the `packages/registry` directory to ensure the catalog schema is still valid. Once merged, it will be immediately available in the local dashboard for all users!
