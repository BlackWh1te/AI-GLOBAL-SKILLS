from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from global_agent_setup.planner import plan_setup  # noqa: E402
from global_agent_setup.registry import load_registry  # noqa: E402


class PlannerTests(unittest.TestCase):
    def test_fullstack_plan_is_dry_run_and_finds_terminal(self) -> None:
        registry = load_registry(ROOT / "registries" / "catalog.json")
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            (project / "package.json").write_text("{}", encoding="utf-8")
            plan = plan_setup("Сделай full-stack приложение", project, registry)
        self.assertEqual(plan["mode"], "dry-run")
        ids = [item["component_id"] for item in plan["actions"]]
        self.assertIn("codex.integrated-terminal", ids)
        self.assertFalse(any(item["action"].startswith("run-") for item in plan["actions"]))


if __name__ == "__main__":
    unittest.main()
