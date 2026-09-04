---
name: Project Master Rules
description: Comprehensive instructions for any AI agent interacting with the Global MCP Control Plane project.
trigger: always_on
---

# Global MCP Control Plane - Agent Instructions

You are an AI agent assisting with the **Global MCP Control Plane** project. You MUST ALWAYS follow these rules:

## 1. Versioning and Releases (Always Everywhere)
- **Automatic Bumps**: The project uses `release-please`. We have configured `release-please-config.json` to automatically update the version in ALL `package.json` files across the entire monorepo (`apps/*`, `packages/*`).
- **Agent Rule**: If you ever write code that outputs the app version (like in the daemon API or UI), you MUST use dynamic versioning (e.g., importing it from the local `package.json`). This ensures that when the automated release bumps the `package.json`, the version updates *everywhere* instantly.
- **Commits**: You MUST ALWAYS use Conventional Commits (`feat:`, `fix:`, `chore:`). This is strictly required so the automation can generate Changelogs and post Release Notes on GitHub.

## 2. Review Protocol
When the user asks you to "review project", "review", or "check status", you MUST ALWAYS:
1. Read the `task.md` artifact to see what Milestone we are currently working on.
2. Check `git status` to identify uncommitted work.
3. Review the health of the codebase (e.g., run `bun run build`).
4. Provide a structured summary to the user outlining:
   - Current Progress (based on `task.md`).
   - Any broken code or uncommitted changes.
   - The immediate next action required to complete the current milestone.

## 3. Technology Stack
- **Monorepo**: TypeScript, Bun Workspaces.
- **Frontend**: Vite + React (`apps/dashboard`).
- **Backend**: Express + Node.js (`apps/daemon`).
- **Rule**: Never use `npm` or `yarn`. Always use `bun`.

Follow these rules strictly without exceptions.
