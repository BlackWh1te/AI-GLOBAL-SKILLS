from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from global_agent_setup.registry import load_registry  # noqa: E402


class RegistryTests(unittest.TestCase):
    def test_catalog_loads_and_ids_are_unique(self) -> None:
        registry = load_registry(ROOT / "registries" / "catalog.json")
        self.assertGreaterEqual(len(registry.components), 7)
        self.assertEqual(len(registry.components), len(registry.by_id))

    def test_russian_voice_query_matches_audio_reference(self) -> None:
        registry = load_registry(ROOT / "registries" / "catalog.json")
        ids = [item["component"]["id"] for item in registry.search("сделай приложение для изменения голоса")]
        self.assertIn("openai.audio-reference", ids)


if __name__ == "__main__":
    unittest.main()
