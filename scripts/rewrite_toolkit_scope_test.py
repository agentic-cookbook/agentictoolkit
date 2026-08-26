#!/usr/bin/env python3
"""The codemod rewrites exactly the eight moved names and nothing else."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

TOOL = Path(__file__).resolve().parent / "rewrite_toolkit_scope.py"


def run(root: Path, *extra: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(TOOL), "--root", str(root), *extra],
        capture_output=True,
        text=True,
    )


def test_rewrites_a_moved_name() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        f = root / "a.ts"
        f.write_text("import { Button } from '@agentic-toolkit/ui/components/button'\n", encoding="utf-8")
        assert run(root).returncode == 0
        assert "@agenticdevelopertoolkit/ui/components/button" in f.read_text(encoding="utf-8")


def test_leaves_an_unmoved_name_alone() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        f = root / "a.ts"
        f.write_text("import { x } from '@agentic-toolkit/auth'\n", encoding="utf-8")
        assert run(root).returncode == 0
        assert "@agentic-toolkit/auth" in f.read_text(encoding="utf-8")


# Every character npm permits in a package name, immediately after one of the eight.
# The first four are the ones a reader thinks of; the last three are the ones the
# original `(?![a-z0-9-])` lookahead let through — legal names, silently mis-scoped
# to a package that never moved. None exists today, which is exactly why a test has
# to hold the line: the failure would be silent whenever one is created.
NOT_MOVED = (
    "@agentic-toolkit/modelling",
    "@agentic-toolkit/adh-ui",
    "@agentic-toolkit/ui-kit",
    "@agentic-toolkit/search2",
    "@agentic-toolkit/model_x",
    "@agentic-toolkit/uiKit",
    "@agentic-toolkit/ui.legacy",
)


def test_does_not_rewrite_a_prefix_collision() -> None:
    """A moved name must match only when the name ENDS there."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for i, name in enumerate(NOT_MOVED):
            f = root / f"a{i}.ts"
            f.write_text(f"import {{ x }} from '{name}'\n", encoding="utf-8")
        assert run(root).returncode == 0
        for i, name in enumerate(NOT_MOVED):
            body = (root / f"a{i}.ts").read_text(encoding="utf-8")
            assert name in body, body
            assert "@agenticdevelopertoolkit" not in body, body


def test_manifest_rewrites_prose_alongside_a_dependency() -> None:
    """A manifest with BOTH a dependency and a string mention gets both rewritten.

    This is the case the old `if count == 0: return rewrite_source(text)` shape
    missed entirely: any manifest whose dependencies changed skipped the string
    pass and kept prose pointing at a package that had moved. Both fields are real
    shapes from this repo — `comment:`-prefixed and `//`-prefixed sibling keys are
    how the manifests here carry their explanations.
    """
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        pkg_dir = root / "packages" / "web" / "packages" / "thing"
        pkg_dir.mkdir(parents=True)
        pkg = pkg_dir / "package.json"
        pkg.write_text(
            json.dumps(
                {
                    "comment:exports": "see @agentic-toolkit/ui for the base components",
                    "//dependencies": "@agentic-toolkit/themes rides on @agentic-toolkit/auth",
                    "dependencies": {
                        "@agentic-toolkit/ui": "workspace:*",
                        "@agentic-toolkit/auth": "workspace:*",
                    },
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        target = root / "external" / "adt" / "packages" / "web" / "packages"
        target.mkdir(parents=True)
        assert run(root, "--link-target", str(target)).returncode == 0

        data = json.loads(pkg.read_text(encoding="utf-8"))
        # the structural rewrite still happened, protocol and path included
        assert data["dependencies"]["@agenticdevelopertoolkit/ui"] == (
            "link:../../../../external/adt/packages/web/packages/ui"
        ), data["dependencies"]
        assert data["dependencies"]["@agentic-toolkit/auth"] == "workspace:*"
        # ...and so did the prose, in the same run
        assert data["comment:exports"] == (
            "see @agenticdevelopertoolkit/ui for the base components"
        ), data["comment:exports"]
        assert data["//dependencies"] == (
            "@agenticdevelopertoolkit/themes rides on @agentic-toolkit/auth"
        ), data["//dependencies"]


def test_rewrites_package_json_keys_and_link_paths() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        pkg_dir = root / "packages" / "web" / "packages" / "thing"
        pkg_dir.mkdir(parents=True)
        pkg = pkg_dir / "package.json"
        pkg.write_text(
            json.dumps(
                {
                    "dependencies": {
                        "@agentic-toolkit/ui": "link:../ui",
                        "@agentic-toolkit/auth": "workspace:*",
                    }
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        target = root / "external" / "adt" / "packages" / "web" / "packages"
        target.mkdir(parents=True)
        assert run(root, "--link-target", str(target)).returncode == 0
        deps = json.loads(pkg.read_text(encoding="utf-8"))["dependencies"]
        assert "@agenticdevelopertoolkit/ui" in deps
        assert "@agentic-toolkit/ui" not in deps
        assert deps["@agenticdevelopertoolkit/ui"] == (
            "link:../../../../external/adt/packages/web/packages/ui"
        ), deps["@agenticdevelopertoolkit/ui"]
        assert deps["@agentic-toolkit/auth"] == "workspace:*"


def test_link_depth_is_computed_per_manifest() -> None:
    """A package one directory deeper must climb one level further.

    The two depths coexist in agentictoolkit today — packages/web/packages/<pkg>
    against packages/web/packages/features/<pkg> — so a single shared prefix is
    wrong for one of them no matter which one it is written for.
    """
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        target = root / "external" / "adt" / "packages" / "web" / "packages"
        target.mkdir(parents=True)
        written = {}
        for rel in ("packages/web/packages/flat", "packages/web/packages/features/deep"):
            d = root / rel
            d.mkdir(parents=True)
            (d / "package.json").write_text(
                json.dumps({"dependencies": {"@agentic-toolkit/themes": "link:../themes"}}),
                encoding="utf-8",
            )
            written[rel] = d / "package.json"

        assert run(root, "--link-target", str(target)).returncode == 0

        flat = json.loads(written["packages/web/packages/flat"].read_text(encoding="utf-8"))
        deep = json.loads(written["packages/web/packages/features/deep"].read_text(encoding="utf-8"))
        flat_value = flat["dependencies"]["@agenticdevelopertoolkit/themes"]
        deep_value = deep["dependencies"]["@agenticdevelopertoolkit/themes"]
        assert flat_value.count("../") == 4, flat_value
        assert deep_value.count("../") == 5, deep_value


def test_workspace_protocol_becomes_a_link() -> None:
    """A moved name declared `workspace:*` must become a computed `link:`.

    Most of agentictoolkit's dependencies on the eight are `workspace:*`, not
    `link:`. Once the eight leave the workspace, `workspace:*` on those names
    resolves to nothing and `pnpm install` fails; pnpm cannot nest the vendored
    toolkit's workspace inside this one, so `link:` is the only shape that works
    — the same one bitbag and persona already use for their crossings.
    """
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        pkg_dir = root / "packages" / "web" / "packages" / "thing"
        pkg_dir.mkdir(parents=True)
        pkg = pkg_dir / "package.json"
        pkg.write_text(
            json.dumps(
                {
                    "dependencies": {
                        "@agentic-toolkit/ui": "workspace:*",
                        "@agentic-toolkit/auth": "workspace:*",
                    }
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        target = root / "external" / "adt" / "packages" / "web" / "packages"
        target.mkdir(parents=True)
        assert run(root, "--link-target", str(target)).returncode == 0
        deps = json.loads(pkg.read_text(encoding="utf-8"))["dependencies"]
        assert deps["@agenticdevelopertoolkit/ui"] == (
            "link:../../../../external/adt/packages/web/packages/ui"
        ), deps["@agenticdevelopertoolkit/ui"]
        assert deps["@agentic-toolkit/auth"] == "workspace:*"


def test_dry_run_changes_nothing() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        f = root / "a.ts"
        original = "import { Button } from '@agentic-toolkit/ui'\n"
        f.write_text(original, encoding="utf-8")
        result = run(root, "--dry-run")
        assert result.returncode == 0
        assert f.read_text(encoding="utf-8") == original
        assert "a.ts" in result.stdout


if __name__ == "__main__":
    test_rewrites_a_moved_name()
    test_leaves_an_unmoved_name_alone()
    test_does_not_rewrite_a_prefix_collision()
    test_manifest_rewrites_prose_alongside_a_dependency()
    test_rewrites_package_json_keys_and_link_paths()
    test_link_depth_is_computed_per_manifest()
    test_workspace_protocol_becomes_a_link()
    test_dry_run_changes_nothing()
    print("rewrite_toolkit_scope_test: 8 passed")
