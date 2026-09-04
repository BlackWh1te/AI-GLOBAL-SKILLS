from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from .inspector import inspect_project
from .planner import plan_setup
from .registry import load_registry


SERVER_INFO = {"name": "global-agent-setup", "version": "0.1.0"}


def _plugin_root() -> Path:
    configured = os.environ.get("PLUGIN_ROOT")
    return Path(configured).resolve() if configured else Path(__file__).resolve().parents[2]


def _registry_path(value: object = None) -> Path:
    if isinstance(value, str) and value.strip():
        return Path(value).expanduser().resolve()
    return _plugin_root() / "registries" / "catalog.json"


TOOLS = [
    {
        "name": "inspect_project",
        "description": "Inspect a project without changing it and report ecosystems, manifests, skills, and setup lock entries.",
        "inputSchema": {
            "type": "object",
            "properties": {"root": {"type": "string", "default": "."}},
            "additionalProperties": False,
        },
    },
    {
        "name": "search_registry",
        "description": "Search reviewed component metadata for relevant skills, plugins, MCP servers, tools, or references.",
        "inputSchema": {
            "type": "object",
            "required": ["query"],
            "properties": {
                "query": {"type": "string", "minLength": 1},
                "platform": {"type": "string", "enum": ["codex", "chatgpt-work"], "default": "codex"},
                "registry_path": {"type": "string"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "plan_setup",
        "description": "Create a dry-run capability setup plan from a request and current project state. This tool never installs anything.",
        "inputSchema": {
            "type": "object",
            "required": ["request"],
            "properties": {
                "request": {"type": "string", "minLength": 1},
                "root": {"type": "string", "default": "."},
                "platform": {"type": "string", "enum": ["codex", "chatgpt-work"], "default": "codex"},
                "registry_path": {"type": "string"},
            },
            "additionalProperties": False,
        },
    },
]


def _call_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "inspect_project":
        return inspect_project(arguments.get("root", ".")).to_dict()
    if name == "search_registry":
        query = arguments.get("query")
        if not isinstance(query, str) or not query.strip():
            raise ValueError("query must be a non-empty string")
        registry = load_registry(_registry_path(arguments.get("registry_path")))
        return {"query": query, "results": registry.search(query, platform=arguments.get("platform", "codex"))}
    if name == "plan_setup":
        request = arguments.get("request")
        if not isinstance(request, str) or not request.strip():
            raise ValueError("request must be a non-empty string")
        registry = load_registry(_registry_path(arguments.get("registry_path")))
        return plan_setup(request, arguments.get("root", "."), registry, platform=arguments.get("platform", "codex"))
    raise KeyError(name)


def _result(request_id: object, payload: object) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": payload}


def _error(request_id: object, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def handle(message: dict[str, Any]) -> dict[str, Any] | None:
    request_id = message.get("id")
    method = message.get("method")
    params = message.get("params", {})
    if method == "initialize":
        requested_version = params.get("protocolVersion") if isinstance(params, dict) else None
        version = requested_version if isinstance(requested_version, str) else "2025-06-18"
        return _result(request_id, {
            "protocolVersion": version,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": SERVER_INFO,
            "instructions": "Read-only project inspection, registry search, and setup planning. No installation tools are exposed.",
        })
    if method in {"notifications/initialized", "notifications/cancelled"}:
        return None
    if method == "ping":
        return _result(request_id, {})
    if method == "tools/list":
        return _result(request_id, {"tools": TOOLS})
    if method == "tools/call":
        if not isinstance(params, dict) or not isinstance(params.get("name"), str):
            return _error(request_id, -32602, "Invalid tools/call parameters")
        arguments = params.get("arguments", {})
        if not isinstance(arguments, dict):
            return _error(request_id, -32602, "Tool arguments must be an object")
        try:
            payload = _call_tool(params["name"], arguments)
            rendered = json.dumps(payload, ensure_ascii=False, indent=2)
            return _result(request_id, {
                "content": [{"type": "text", "text": rendered}],
                "structuredContent": payload,
                "isError": False,
            })
        except KeyError:
            return _error(request_id, -32601, f"Unknown tool: {params['name']}")
        except Exception as exc:
            return _result(request_id, {
                "content": [{"type": "text", "text": str(exc)}],
                "isError": True,
            })
    if request_id is None:
        return None
    return _error(request_id, -32601, f"Method not found: {method}")


def main() -> int:
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            message = json.loads(line)
            if not isinstance(message, dict):
                raise ValueError("JSON-RPC message must be an object")
            response = handle(message)
        except Exception as exc:
            response = _error(None, -32700, f"Invalid request: {exc}")
        if response is not None:
            sys.stdout.write(json.dumps(response, ensure_ascii=False, separators=(",", ":")) + "\n")
            sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
