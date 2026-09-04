# Decision and trust policy

Read this reference when ranking candidates or preparing an installation plan.

## Candidate ranking

Prefer, in order:

1. A capability already available in the current environment.
2. A first-party or workspace-approved plugin.
3. A curated component with an immutable version and compatible license.
4. A reviewed open-source component pinned to a commit.
5. A manual gap report when no reviewed component exists.

Use request keywords only to discover candidates. Final selection must also match
the platform, project signals, declared capabilities, and policy.

## Risk tiers

| Tier | Typical component | Required gate |
| --- | --- | --- |
| low | Read-only built-in tool | Verify availability |
| medium | Marketplace plugin or read-only remote MCP | Confirm installation/auth scope |
| high | Local MCP, package installer, repository write tool | Review source and exact changes, then confirm |
| blocked | Unknown license, mutable ref, embedded secret, broad destructive tool | Do not install |

## Source checks

For Git sources require repository URL, license identifier, immutable commit SHA,
expected subtree, and content hash. Inspect install hooks, generated binaries,
network behavior, filesystem scope, credential access, and transitive packages.

For remote MCP servers require HTTPS, documented authentication, a minimal tool
scope, data-handling terms, and a clear owner. Credentials remain client-managed.

## Plan semantics

`verify-capability` is read-only. `install-plugin`, `install-skill`,
`configure-mcp`, and `install-package` are mutations and require confirmation.
Never combine approval for multiple high-risk components into a vague single
question; show their exact sources and effects.
