---
name: global-agent-setup
description: Analyze a new or existing software project and propose the skills, plugins, MCP servers, and built-in tools needed to complete a requested build. Use for project capability setup and gap analysis; do not use for ordinary implementation after the environment is ready.
---

# Global Agent Setup

Turn the user's requested outcome and the current project state into a safe,
reviewable capability plan.

## Workflow

1. Inspect the project before recommending anything. Prefer the bundled
   `inspect_project` MCP tool. If it is unavailable, run
   `python3 scripts/global_agent_setup.py inspect --root <project-root>` from the
   plugin root.
2. Preserve explicit technology choices. Infer only missing capabilities, not a
   replacement product architecture.
3. Build a plan with the bundled `plan_setup` MCP tool or CLI `plan` command.
   Treat registry matches as candidates and explain why each is relevant.
4. Present three groups: already available, recommended additions, and blocked or
   manual prerequisites. State source, risk, and permissions for every addition.
5. Obtain explicit user authorization immediately before installing a plugin,
   skill, MCP server, package, or changing configuration. A setup request alone
   does not authorize arbitrary external code execution.
6. After authorized changes, inspect again, verify observable capabilities, and
   write a lock record containing exact versions or immutable source revisions.

## Invariants

- Never clone, install, or run a GitHub project solely because its keywords,
  README, stars, or registry score look relevant.
- Require a known license and immutable revision for Git sources.
- Never place credentials in manifests, registry records, commands, or chat.
- Do not silently modify user-wide configuration or files outside the approved
  project/plugin locations.
- Prefer an already available built-in tool over installing a duplicate.
- A skill cannot portably execute another skill as a function. Install or expose
  the dependency, then let Codex select it or invoke it explicitly by name.
- Stop when a required capability has no reviewed candidate; report the gap
  instead of inventing an integration.

For scoring, trust tiers, and installation gates, read
[references/decision-policy.md](references/decision-policy.md).
