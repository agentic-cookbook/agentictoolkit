"""Regression test for `_stable_output.keeping_mtime_if_unchanged`.

Stdlib-only and self-executing (`python3 tools/test_stable_output.py`, exit 0 = pass)
rather than pytest like its `test_spec_input.py` sibling, because this one is WIRED:
it runs from this package's `test` script, so `pnpm -r --if-present test` covers it in
both the toolkit's CI and adh's "Toolkit unit tests" step. A guard against a
regression that only shows up as a red vendored-freshness check two repos away has to
run somewhere, and pytest is not installed on that path.

The failure this pins cost a CI gate its remedy: a no-op rerun bumped the mtime of a
file `dist_staleness()` treats as a build input, the check reported a rollback, and the
rebuild it prescribed was content-gated and did nothing.
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _stable_output import keeping_mtime_if_unchanged  # noqa: E402

# Far enough in the past that a restore is unmistakable, and no filesystem's mtime
# granularity can make "kept" and "rewritten now" look the same.
OLD_NS = 1_000_000_000 * 10**9


class KeepingMtimeIfUnchanged(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.path = Path(self._tmp.name) / "generated.ts"

    def _aged(self, body: str) -> Path:
        self.path.write_text(body)
        os.utime(self.path, ns=(OLD_NS, OLD_NS))
        return self.path

    def test_identical_output_keeps_the_original_mtime(self) -> None:
        self._aged("export const X = 1\n")
        with keeping_mtime_if_unchanged(self.path):
            self.path.write_text("export const X = 1\n")
        self.assertEqual(self.path.stat().st_mtime_ns, OLD_NS)

    def test_a_real_change_takes_a_fresh_mtime(self) -> None:
        self._aged("export const X = 1\n")
        with keeping_mtime_if_unchanged(self.path):
            self.path.write_text("export const X = 2\n")
        self.assertGreater(self.path.stat().st_mtime_ns, OLD_NS)
        self.assertEqual(self.path.read_text(), "export const X = 2\n")

    def test_a_first_build_has_nothing_to_keep(self) -> None:
        with keeping_mtime_if_unchanged(self.path):
            self.path.write_text("export const X = 1\n")
        self.assertEqual(self.path.read_text(), "export const X = 1\n")

    def test_a_failed_run_propagates_and_restores_nothing(self) -> None:
        self._aged("export const X = 1\n")
        with self.assertRaises(RuntimeError):
            with keeping_mtime_if_unchanged(self.path):
                self.path.write_text("half a fi")
                raise RuntimeError("generator died mid-write")
        # The truncated file must NOT inherit the whole one's timestamp — a downstream
        # staleness check has to see that this tree was touched.
        self.assertGreater(self.path.stat().st_mtime_ns, OLD_NS)


if __name__ == "__main__":
    unittest.main(verbosity=2)
