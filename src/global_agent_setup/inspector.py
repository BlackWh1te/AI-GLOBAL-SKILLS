from __future__ import annotations

import json
import os
from pathlib import Path

from .models import ProjectSnapshot


IGNORE_DIRS = {".git", ".venv", "node_modules", "dist", "build", "target", "vendor", "__pycache__"}
ECOSYSTEM_FILES = {
    "package.json": "nodejs",
    "tsconfig.json": "typescript",
    "pyproject.toml": "python",
    "requirements.txt": "python",
    "Cargo.toml": "rust",
    "go.mod": "go",
    "Gemfile": "ruby",
    "composer.json": "php",
    "Dockerfile": "docker",
}


def _walk_files(root: Path, max_files: int) -> list[Path]:
    files: list[Path] = []
    for current, dirs, names in os.walk(root):
        dirs[:] = sorted(directory for directory in dirs if directory not in IGNORE_DIRS)
        current_path = Path(current)
        for name in sorted(names):
            files.append(current_path / name)
            if len(files) >= max_files:
                return files
    return files


def _read_skill_name(skill_md: Path) -> str:
    try:
        for line in skill_md.read_text(encoding="utf-8").splitlines()[:30]:
            if line.startswith("name:"):
                return line.split(":", 1)[1].strip().strip('"\'')
    except OSError:
        pass
    return skill_md.parent.name


def inspect_project(root: str | Path, *, max_files: int = 5000) -> ProjectSnapshot:
    resolved = Path(root).expanduser().resolve()
    if not resolved.is_dir():
        raise ValueError(f"project root is not a directory: {resolved}")
    files = _walk_files(resolved, max_files)
    relative = {path.relative_to(resolved).as_posix(): path for path in files}
    ecosystems = {ecosystem for filename, ecosystem in ECOSYSTEM_FILES.items() if filename in relative}
    signals = set(ecosystems)
    if ".openai/hosting.json" in relative:
        signals.add("openai-sites")
    if any(name.startswith(".github/") for name in relative):
        signals.add("github")
    if any(name.endswith((".tsx", ".jsx", ".vue", ".svelte")) for name in relative):
        signals.add("frontend")
    if any(name.endswith((".py", ".go", ".rs", ".java")) for name in relative):
        signals.add("backend")

    skill_files = [
        path for name, path in relative.items()
        if name.endswith("/SKILL.md") and (
            name.startswith("skills/") or name.startswith(".codex/skills/") or name.startswith(".agents/skills/")
        )
    ]
    skills = {_read_skill_name(path) for path in skill_files}
    manifests = {
        name for name in relative
        if name in {".codex-plugin/plugin.json", ".mcp.json", "mcp.json", "AGENTS.md"}
        or name in ECOSYSTEM_FILES
        or name.endswith("/plugin.json")
        or Path(name).name.startswith(("playwright.config.", "vite.config.", "next.config."))
    }

    lock_components: set[str] = set()
    lock_path = resolved / "global-agent-setup.lock.json"
    if lock_path.is_file():
        try:
            lock_payload = json.loads(lock_path.read_text(encoding="utf-8"))
            items = lock_payload.get("components", []) if isinstance(lock_payload, dict) else []
            for item in items:
                if isinstance(item, dict) and isinstance(item.get("id"), str):
                    lock_components.add(item["id"])
        except (OSError, json.JSONDecodeError):
            signals.add("invalid-setup-lock")

    return ProjectSnapshot(
        root=resolved,
        files_scanned=len(files),
        ecosystems=tuple(sorted(ecosystems)),
        signals=tuple(sorted(signals)),
        skills=tuple(sorted(skills)),
        manifests=tuple(sorted(manifests)),
        lock_components=tuple(sorted(lock_components)),
    )
