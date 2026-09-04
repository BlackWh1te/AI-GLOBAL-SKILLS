#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLUGIN_ROOT / "src"))

from global_agent_setup.registry import component_rows, load_registry  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Export the component catalog as CSV")
    parser.add_argument("--registry", default=str(PLUGIN_ROOT / "registries" / "catalog.json"))
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    registry = load_registry(args.registry)
    rows = list(component_rows(registry.components))
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]) if rows else ["id"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"exported {len(rows)} components to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
