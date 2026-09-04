from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ALLOWED_KINDS = {"skill", "plugin", "mcp", "tool", "reference"}
ALLOWED_RISKS = {"low", "medium", "high", "blocked"}
ALLOWED_STATUSES = {"candidate", "reviewed", "curated", "deprecated", "blocked"}
ALLOWED_INSTALL_MODES = {"builtin", "plugin", "skill", "mcp", "manual"}


class CatalogError(ValueError):
    """Raised when catalog data violates the V1 contract."""


@dataclass(frozen=True)
class Source:
    type: str
    locator: str
    license: str | None
    revision: str | None


@dataclass(frozen=True)
class InstallSpec:
    mode: str
    requires_confirmation: bool


@dataclass(frozen=True)
class Component:
    id: str
    name: str
    kind: str
    summary: str
    capabilities: tuple[str, ...]
    keywords: tuple[str, ...]
    project_files: tuple[str, ...]
    platforms: tuple[str, ...]
    source: Source
    install: InstallSpec
    risk: str
    status: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ProjectSnapshot:
    root: Path
    files_scanned: int
    ecosystems: tuple[str, ...]
    signals: tuple[str, ...]
    skills: tuple[str, ...]
    manifests: tuple[str, ...]
    lock_components: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["root"] = str(self.root)
        return payload


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CatalogError(f"{label} must be a non-empty string")
    return value.strip()


def require_string_list(value: Any, label: str, *, nonempty: bool = False) -> tuple[str, ...]:
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        raise CatalogError(f"{label} must be an array of non-empty strings")
    items = tuple(item.strip() for item in value)
    if nonempty and not items:
        raise CatalogError(f"{label} must not be empty")
    if len(items) != len(set(items)):
        raise CatalogError(f"{label} must not contain duplicates")
    return items
