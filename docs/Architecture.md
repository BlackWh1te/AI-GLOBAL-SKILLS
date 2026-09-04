# Architecture

The system is built as a **TypeScript Monorepo** using Bun workspaces.

## Applications
- **Daemon (`apps/daemon`)**: An Express.js backend running on `127.0.0.1:3000`. It acts as the local control plane, overseeing installed MCP servers, monitoring their stdout/stderr, and exposing a REST API.
- **Dashboard (`apps/dashboard`)**: A Vite + React frontend. It polls the Daemon for status updates, rendering a beautiful interface for viewing active servers, errors, and installing new ones from the Catalog.

## Packages
- **Core (`packages/core`)**: Shared TypeScript interfaces, common logging, and base MCP schemas.
- **Registry (`packages/registry`)**: A syncing engine that pulls MCP definitions from `registries/catalog.json` and external sources.
- **Installer (`packages/installer`)**: Handles isolated downloading, dependency installation, and lockfile generation.
- **Client Adapters (`packages/client-adapters`)**: Bridges that automatically inject the configuration of running MCP servers into AI IDEs like Antigravity, Cursor, and Windsurf.
