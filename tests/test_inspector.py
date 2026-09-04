from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from global_agent_setup.inspector import inspect_project  # noqa: E402


class InspectorTests(unittest.TestCase):
    def test_detects_node_typescript_and_skill(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "package.json").write_text("{}", encoding="utf-8")
            (root / "tsconfig.json").write_text("{}", encoding="utf-8")
            skill = root / "skills" / "demo"
            skill.mkdir(parents=True)
            (skill / "SKILL.md").write_text("---\nname: demo\ndescription: Demo\n---\n", encoding="utf-8")
            snapshot = inspect_project(root)
            self.assertEqual(snapshot.ecosystems, ("nodejs", "typescript"))
            self.assertIn("demo", snapshot.skills)
            self.assertIn("package.json", snapshot.manifests)


if __name__ == "__main__":
    unittest.main()
