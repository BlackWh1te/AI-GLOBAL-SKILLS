# Global MCP Control Plane

[![CI](https://github.com/blackwh1te/AI-GLOBAL-SKILLS/actions/workflows/ci.yml/badge.svg)](https://github.com/blackwh1te/AI-GLOBAL-SKILLS/actions/workflows/ci.yml)
[![Release](https://github.com/blackwh1te/AI-GLOBAL-SKILLS/actions/workflows/release.yml/badge.svg)](https://github.com/blackwh1te/AI-GLOBAL-SKILLS/actions/workflows/release.yml)

A professional local web dashboard and CLI to discover, install, configure, run, monitor, update, and remove MCP (Model Context Protocol) servers without manually visiting GitHub, cloning repositories, or editing configuration files.

## Features

- **Dashboard & CLI**: Manage MCP servers through a modern web UI or terminal commands.
- **Secure Installation**: Downloads exactly pinned versions from NPM with full integrity checks, blocks lifecycle scripts by default, and installs into isolated directories.
- **IDE Injection**: Seamlessly inject MCP server configurations into AI clients like Cursor, Windsurf, Claude Code, and VS Code. Previews diffs securely.
- **Secrets Management**: Manages and redacts environment variables and API keys required by MCP servers securely.
- **Audit Logging**: Keeps an immutable trail of installations, configuration changes, and process management.

## Getting Started

### Prerequisites
- Node.js (v20+)
- Bun (v1.4+)

### Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/blackwh1te/AI-GLOBAL-SKILLS.git
cd AI-GLOBAL-SKILLS
bun install
bun run build
```

### Running the Daemon & Dashboard
```bash
bun run start
```
By default, the daemon binds to `http://127.0.0.1:3000`. The dashboard will automatically open in your browser.

### CLI Usage
You can run the CLI from the `apps/cli` package, or link it globally:
```bash
cd apps/cli
bun link
global-mcp help
```

## Contributing
Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for information about how to develop, test, and submit pull requests.

- [Architecture](./ARCHITECTURE.md)
- [Security](./SECURITY.md)

## License
MIT License