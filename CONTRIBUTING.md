# Contributing to Global MCP Control Plane

First off, thanks for taking the time to contribute! 🎉 

This project aims to be the easiest, most robust local dashboard and daemon for managing AI MCP servers. We welcome contributions from everyone—whether it's fixing bugs, improving documentation, or adding new AI client adapters.

---

## 🛠️ 1. Project Setup (Local Development)

We use a **TypeScript Monorepo** managed by [Bun](https://bun.sh). 

### Prerequisites
- Install **Bun** (`curl -fsSL https://bun.sh/install | bash` or via PowerShell on Windows).
- Node.js (v18+) for executing some legacy MCP scripts.

### Quick Start
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/AI-GLOBAL-SKILLS.git
   cd AI-GLOBAL-SKILLS
   ```
2. Install all dependencies across the monorepo:
   ```bash
   bun install
   ```
3. Run the development environment:
   - **Daemon (API)**: `cd apps/daemon && bun run dev`
   - **Dashboard (UI)**: `cd apps/dashboard && bun run dev`

---

## 🏗️ 2. Monorepo Architecture

Our codebase is split into apps and packages:
- `apps/dashboard`: The React + Vite frontend dashboard.
- `apps/daemon`: The local Node.js control plane API (port 3000).
- `packages/registry`: Logic for fetching and querying the MCP catalog.
- `packages/installer`: Logic for isolating and installing MCP servers.
- `packages/client-adapters`: Adapters that inject MCP configurations into IDEs (Cursor, Windsurf, etc.).

---

## 🧩 3. How to Contribute

### Adding a new Client Adapter
Want to add support for a new AI IDE (e.g., Cline, continue.dev)?
1. Navigate to `packages/client-adapters/src/`.
2. Create a new class implementing the `ClientAdapter` interface.
3. Your adapter must handle checking if the IDE is installed, and safely backing up its configuration file before injecting new MCP server details.
4. Export it in `packages/client-adapters/src/index.ts`.

### Adding a new MCP Server to the Catalog
If you have an awesome MCP server you want everyone to discover:
1. Open `registries/catalog.json`.
2. Add your server following the schema (include capabilities, platforms, and risk level).
3. Ensure the `locator` points to a stable GitHub repository or npm package.

---

## ✅ 4. Committing and Submitting a PR

This project uses **Release Please** for fully automated versioning and Changelog generation. Because of this, **you must use Conventional Commits**.

### Commit Message Format
```text
<type>: <short description>
```
- `feat:` for new features (e.g., `feat: add support for Cursor IDE`) -> *Triggers Minor Release*
- `fix:` for bug fixes (e.g., `fix: resolve port 3000 crash`) -> *Triggers Patch Release*
- `docs:`, `chore:`, `style:`, `refactor:`, `test:` for other changes.

### Making a Pull Request
1. Create a branch: `git checkout -b feature/my-awesome-idea`
2. Commit your changes using the format above.
3. Push to your fork and open a Pull Request against the `main` branch.
4. The CI pipeline will automatically run `bun run build` and tests. If it passes, a maintainer will review it!

We can't wait to see what you build. Happy coding! 🚀
