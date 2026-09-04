from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from .models import (
    ALLOWED_INSTALL_MODES,
    ALLOWED_KINDS,
    ALLOWED_RISKS,
    ALLOWED_STATUSES,
    CatalogError,
    Component,
    InstallSpec,
    Source,
    require_string,
    require_string_list,
)


ID_PATTERN = re.compile(r"^[a-z0-9]+(?:[.-][a-z0-9]+)*$")
TOP_LEVEL_KEYS = {"schema_version", "generated_at", "components"}
COMPONENT_KEYS = {
    "id", "name", "kind", "summary", "capabilities", "keywords",
    "project_files", "platforms", "source", "install", "risk", "status",
}


@dataclass(frozen=True)
class Registry:
    schema_version: str
    generated_at: str
    components: tuple[Component, ...]
    path: Path

    @property
    def by_id(self) -> dict[str, Component]:
        return {component.id: component for component in self.components}

    def search(self, query: str, *, platform: str = "codex") -> list[dict[str, Any]]:
        normalized = query.casefold().strip()
        tokens = set(re.findall(r"[\w.+#-]+", normalized, flags=re.UNICODE))
        results: list[tuple[int, Component, list[str]]] = []
        for component in self.components:
            if platform not in component.platforms or component.status in {"blocked", "deprecated"}:
                continue
            score = 0
            reasons: list[str] = []
            haystack = " ".join((component.id, component.name, component.summary, *component.capabilities)).casefold()
            for keyword in component.keywords:
                folded = keyword.casefold()
                if folded and folded in normalized:
                    score += 4 if " " in folded else 3
                    reasons.append(f"keyword:{keyword}")
            for token in tokens:
                if token in haystack:
                    score += 1
            if score:
                results.append((score, component, sorted(set(reasons))))
        results.sort(key=lambda item: (-item[0], item[1].id))
        return [
            {"score": score, "reasons": reasons, "component": component.to_dict()}
            for score, component, reasons in results
        ]


def _exact_keys(payload: dict[str, Any], allowed: set[str], label: str) -> None:
    extra = sorted(set(payload) - allowed)
    missing = sorted(allowed - set(payload))
    if extra:
        raise CatalogError(f"{label} has unknown fields: {', '.join(extra)}")
    if missing:
        raise CatalogError(f"{label} is missing fields: {', '.join(missing)}")


def _component_from_dict(payload: Any, index: int) -> Component:
    label = f"components[{index}]"
    if not isinstance(payload, dict):
        raise CatalogError(f"{label} must be an object")
    _exact_keys(payload, COMPONENT_KEYS, label)
    component_id = require_string(payload["id"], f"{label}.id")
    if not ID_PATTERN.fullmatch(component_id):
        raise CatalogError(f"{label}.id has an invalid format")
    kind = require_string(payload["kind"], f"{label}.kind")
    risk = require_string(payload["risk"], f"{label}.risk")
    status = require_string(payload["status"], f"{label}.status")
    if kind not in ALLOWED_KINDS:
        raise CatalogError(f"{label}.kind is not supported: {kind}")
    if risk not in ALLOWED_RISKS:
        raise CatalogError(f"{label}.risk is not supported: {risk}")
    if status not in ALLOWED_STATUSES:
        raise CatalogError(f"{label}.status is not supported: {status}")

    source_payload = payload["source"]
    if not isinstance(source_payload, dict):
        raise CatalogError(f"{label}.source must be an object")
    _exact_keys(source_payload, {"type", "locator", "license", "revision"}, f"{label}.source")
    license_value = source_payload["license"]
    revision_value = source_payload["revision"]
    if license_value is not None and not isinstance(license_value, str):
        raise CatalogError(f"{label}.source.license must be a string or null")
    if revision_value is not None and not isinstance(revision_value, str):
        raise CatalogError(f"{label}.source.revision must be a string or null")
    source = Source(
        type=require_string(source_payload["type"], f"{label}.source.type"),
        locator=require_string(source_payload["locator"], f"{label}.source.locator"),
        license=license_value,
        revision=revision_value,
    )

    install_payload = payload["install"]
    if not isinstance(install_payload, dict):
        raise CatalogError(f"{label}.install must be an object")
    _exact_keys(install_payload, {"mode", "requires_confirmation"}, f"{label}.install")
    mode = require_string(install_payload["mode"], f"{label}.install.mode")
    if mode not in ALLOWED_INSTALL_MODES:
        raise CatalogError(f"{label}.install.mode is not supported: {mode}")
    if not isinstance(install_payload["requires_confirmation"], bool):
        raise CatalogError(f"{label}.install.requires_confirmation must be boolean")

    return Component(
        id=component_id,
        name=require_string(payload["name"], f"{label}.name"),
        kind=kind,
        summary=require_string(payload["summary"], f"{label}.summary"),
        capabilities=require_string_list(payload["capabilities"], f"{label}.capabilities", nonempty=True),
        keywords=require_string_list(payload["keywords"], f"{label}.keywords"),
        project_files=require_string_list(payload["project_files"], f"{label}.project_files"),
        platforms=require_string_list(payload["platforms"], f"{label}.platforms", nonempty=True),
        source=source,
        install=InstallSpec(mode=mode, requires_confirmation=install_payload["requires_confirmation"]),
        risk=risk,
        status=status,
    )


def load_registry(path: str | Path) -> Registry:
    resolved = Path(path).expanduser().resolve()
    try:
        payload = json.loads(resolved.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise CatalogError(f"catalog not found: {resolved}") from exc
    except json.JSONDecodeError as exc:
        raise CatalogError(f"catalog is not valid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise CatalogError("catalog root must be an object")
    _exact_keys(payload, TOP_LEVEL_KEYS, "catalog")
    if payload["schema_version"] != "1.0":
        raise CatalogError("catalog.schema_version must be 1.0")
    generated_at = require_string(payload["generated_at"], "catalog.generated_at")
    raw_components = payload["components"]
    if not isinstance(raw_components, list):
        raise CatalogError("catalog.components must be an array")
    components = tuple(_component_from_dict(item, index) for index, item in enumerate(raw_components))
    ids = [component.id for component in components]
    if len(ids) != len(set(ids)):
        raise CatalogError("component ids must be unique")
    return Registry("1.0", generated_at, components, resolved)


def component_rows(components: Iterable[Component]) -> Iterable[dict[str, str]]:
    for component in components:
        yield {
            "id": component.id,
            "name": component.name,
            "kind": component.kind,
            "summary": component.summary,
            "capabilities": "|".join(component.capabilities),
            "keywords": "|".join(component.keywords),
            "platforms": "|".join(component.platforms),
            "source_type": component.source.type,
            "source_locator": component.source.locator,
            "license": component.source.license or "",
            "revision": component.source.revision or "",
            "install_mode": component.install.mode,
            "requires_confirmation": str(component.install.requires_confirmation).lower(),
            "risk": component.risk,
            "status": component.status,
        }
