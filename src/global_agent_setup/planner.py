from __future__ import annotations

import fnmatch
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .inspector import inspect_project
from .models import Component, ProjectSnapshot
from .registry import Registry


def _project_match(component: Component, snapshot: ProjectSnapshot) -> list[str]:
    reasons: list[str] = []
    known = set(snapshot.manifests) | set(snapshot.signals)
    for pattern in component.project_files:
        if any(fnmatch.fnmatch(value, pattern) for value in known):
            reasons.append(f"project:{pattern}")
    return reasons


def _action_for(component: Component, installed: bool) -> str:
    if installed:
        return "use-existing"
    return {
        "builtin": "verify-capability",
        "plugin": "install-plugin",
        "skill": "install-skill",
        "mcp": "configure-mcp",
        "manual": "review-reference",
    }[component.install.mode]


def plan_setup(request: str, root: str | Path, registry: Registry, *, platform: str = "codex") -> dict[str, Any]:
    if not request.strip():
        raise ValueError("request must not be empty")
    snapshot = inspect_project(root)
    text_results = {item["component"]["id"]: item for item in registry.search(request, platform=platform)}
    ranked: list[tuple[int, Component, list[str]]] = []
    for component in registry.components:
        if platform not in component.platforms or component.status in {"blocked", "deprecated"}:
            continue
        reasons = list(text_results.get(component.id, {}).get("reasons", []))
        score = int(text_results.get(component.id, {}).get("score", 0))
        project_reasons = _project_match(component, snapshot)
        reasons.extend(project_reasons)
        score += len(project_reasons)
        if score:
            ranked.append((score, component, sorted(set(reasons))))
    ranked.sort(key=lambda item: (-item[0], item[1].id))

    actions: list[dict[str, Any]] = []
    for score, component, reasons in ranked:
        installed = component.id in snapshot.lock_components or component.id in snapshot.skills
        actions.append({
            "component_id": component.id,
            "name": component.name,
            "kind": component.kind,
            "action": _action_for(component, installed),
            "score": score,
            "reasons": reasons,
            "capabilities": list(component.capabilities),
            "source": component.source.locator,
            "risk": component.risk,
            "requires_confirmation": component.install.requires_confirmation and not installed,
        })

    warnings: list[str] = []
    if not actions:
        warnings.append("No reviewed catalog component matched the request or project signals.")
    if snapshot.files_scanned >= 5000:
        warnings.append("Project scan reached the 5000-file safety limit; results may be incomplete.")
    if "invalid-setup-lock" in snapshot.signals:
        warnings.append("Existing global-agent-setup.lock.json is invalid and was ignored.")

    return {
        "plan_version": "1.0",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "mode": "dry-run",
        "platform": platform,
        "request": request,
        "project": snapshot.to_dict(),
        "actions": actions,
        "approval_required": any(item["requires_confirmation"] for item in actions),
        "warnings": warnings,
    }
