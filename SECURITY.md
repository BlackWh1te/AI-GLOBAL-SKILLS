# Security Policy

## Supported Versions

We take security seriously. Currently, we support the following versions of the Global MCP Control Plane:

| Version | Supported          |
| ------- | ------------------ |
| v0.1.x  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please DO NOT open a public issue. 

Instead, please send an email directly to the maintainers or use the GitHub Security Advisories feature to report it privately. We will investigate all legitimate reports and issue a patch as quickly as possible.

### Safe Installation Policy
By design, the Global MCP Control Plane sandboxes MCP server installations. However, if you find a bypass in the isolated installation engine (`packages/installer`), please report it immediately as this is considered a critical severity issue.
