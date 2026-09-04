from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from global_agent_setup.mcp_server import handle  # noqa: E402


class McpServerTests(unittest.TestCase):
    def test_initialize_and_list_tools(self) -> None:
        initialized = handle({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {"protocolVersion": "2025-06-18"},
        })
        self.assertEqual(initialized["result"]["serverInfo"]["name"], "global-agent-setup")
        listed = handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        names = {tool["name"] for tool in listed["result"]["tools"]}
        self.assertEqual(names, {"inspect_project", "search_registry", "plan_setup"})


if __name__ == "__main__":
    unittest.main()
