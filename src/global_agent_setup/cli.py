from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .inspector import inspect_project
from .models import CatalogError
from .planner import plan_setup
from .registry import load_registry


def plugin_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_registry() -> Path:
    return plugin_root() / "registries" / "catalog.json"


def _write(payload: object, output: str | None = None) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if output:
        Path(output).expanduser().resolve().write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="global-agent-setup")
    parser.add_argument("--registry", default=str(default_registry()), help="Path to catalog.json")
    subparsers = parser.add_subparsers(dest="command", required=True)

    inspect_cmd = subparsers.add_parser("inspect", help="Inspect an existing or new project")
    inspect_cmd.add_argument("--root", default=".")

    search_cmd = subparsers.add_parser("search", help="Search the component registry")
    search_cmd.add_argument("query")
    search_cmd.add_argument("--platform", default="codex", choices=("codex", "chatgpt-work"))

    plan_cmd = subparsers.add_parser("plan", help="Create a dry-run setup plan")
    plan_cmd.add_argument("request")
    plan_cmd.add_argument("--root", default=".")
    plan_cmd.add_argument("--platform", default="codex", choices=("codex", "chatgpt-work"))
    plan_cmd.add_argument("--output")

    subparsers.add_parser("validate-registry", help="Validate catalog data")
    return parser


def run(args: argparse.Namespace) -> object:
    if args.command == "inspect":
        return inspect_project(args.root).to_dict()
    registry = load_registry(args.registry)
    if args.command == "validate-registry":
        return {
            "valid": True,
            "schema_version": registry.schema_version,
            "components": len(registry.components),
            "path": str(registry.path),
        }
    if args.command == "search":
        return {"query": args.query, "results": registry.search(args.query, platform=args.platform)}
    if args.command == "plan":
        return plan_setup(args.request, args.root, registry, platform=args.platform)
    raise ValueError(f"unknown command: {args.command}")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        payload = run(args)
        _write(payload, getattr(args, "output", None))
        return 0
    except (CatalogError, OSError, ValueError) as exc:
        sys.stderr.write(f"error: {exc}\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
