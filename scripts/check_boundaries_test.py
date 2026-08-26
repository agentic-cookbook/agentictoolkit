#!/usr/bin/env python3
"""Regression tests for check_boundaries.py — above all, that it CAN fail.

The two guards this replaced both banned `@adh-shared/` and `@adh/`, namespaces
that stopped existing three days after the guards were written. Each then walked
the whole tree, matched nothing that could exist, and printed "clean" on every
run. Nobody noticed, because a passing guard and a blind guard are the same
output. Case 1 is the fix: plant a violation, assert it is reported. Every other
case exists to keep the ban from over-reaching once it can actually bite.

Plain asserts, no framework.
Run: python3 scripts/check_boundaries_test.py   (exit 0 = pass)."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "check_boundaries_under_test", Path(__file__).resolve().parent / "check_boundaries.py"
)
guard = importlib.util.module_from_spec(_SPEC)
sys.modules["check_boundaries_under_test"] = guard
_SPEC.loader.exec_module(guard)

cases: list[tuple[str, object, object]] = []


def check(name, got, want):
    cases.append((name, got, want))


def make_tree(tmp: str, files: dict[str, str], packages: dict[str, str]) -> Path:
    """packages: dir -> npm name. files: relative path -> contents."""
    root = Path(tmp) / "packages"
    for d, name in packages.items():
        p = root / d
        p.mkdir(parents=True, exist_ok=True)
        (p / "package.json").write_text(json.dumps({"name": name}))
    for rel, body in files.items():
        f = root / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(body)
    return root


PKGS = {
    "mechanism-fixture": "@agentic-toolkit/mechanism-fixture",
    "adh": "@agentic-toolkit/adh",
    "adh-registry": "@agentic-toolkit/adh-registry",
}

# ---------------------------------------------------------------- the point

# (1) THE regression: a mechanism package importing the vocabulary tier is
#     reported. If this ever passes silently the guard is blind again.
with tempfile.TemporaryDirectory() as tmp:
    root = make_tree(tmp, {
        "mechanism-fixture/src/x.ts": "import { SITES } from '@agentic-toolkit/adh-registry'\n",
    }, PKGS)
    v = guard.find_violations(root)
    check("mechanism -> vocabulary is a violation", [(p.name, s) for p, _, s, _ in v],
          [("x.ts", "@agentic-toolkit/adh-registry")])

# (2) The banned set is DISCOVERED from the tree, not listed in the source.
#     A newly added `adh-*` package is banned with no edit to the guard.
with tempfile.TemporaryDirectory() as tmp:
    root = make_tree(tmp, {
        "mechanism-fixture/src/x.ts": "import x from '@agentic-toolkit/adh-brandnew'\n",
    }, {**PKGS, "adh-brandnew": "@agentic-toolkit/adh-brandnew"})
    check("a brand-new adh-* package is banned automatically",
          len(guard.find_violations(root)), 1)

# (3) An empty vocabulary set means the guard cannot fail — so main() must
#     REFUSE to report clean rather than exit 0 over a tree it cannot judge.
with tempfile.TemporaryDirectory() as tmp:
    root = make_tree(tmp, {"mechanism-fixture/src/x.ts": "export const x = 1\n"},
                     {"mechanism-fixture": "@agentic-toolkit/mechanism-fixture"})
    check("no vocabulary packages -> refuses to pass", guard.main(["--root", str(root)]), 2)

# ---------------------------------------------------------------- direction

# (4) The legal direction. Vocabulary importing mechanism is the whole design.
with tempfile.TemporaryDirectory() as tmp:
    root = make_tree(tmp, {
        "adh/src/Header.tsx": "import { Button } from '@agentic-toolkit/mechanism-fixture'\n",
    }, PKGS)
    check("vocabulary -> mechanism is fine", guard.find_violations(root), [])

# (5) …and a vocabulary package importing its own tier is not a violation.
with tempfile.TemporaryDirectory() as tmp:
    root = make_tree(tmp, {
        "adh/src/Header.tsx": "import { SITES } from '@agentic-toolkit/adh-registry'\n",
    }, PKGS)
    check("vocabulary -> vocabulary is fine", guard.find_violations(root), [])

# ---------------------------------------------------------------- precision

# (6) Boundary matching, not prefix matching. `adh` must not swallow
#     `adh-registry`'s specifier, and no `adh*` string may be banned by accident.
check("adh does not prefix-match adhesive", guard._is_vocabulary("@agentic-toolkit/adhesive"), False)
check("adh-registry is vocabulary", guard._is_vocabulary("@agentic-toolkit/adh-registry"), True)
check("adh itself is vocabulary", guard._is_vocabulary("@agentic-toolkit/adh"), True)
check("a mechanism-tier name is not vocabulary", guard._is_vocabulary("@agentic-toolkit/mechanism-fixture"), False)
check("subpath of adh matches adh, not adh-registry",
      guard.imports_vocabulary("@agentic-toolkit/adh/header",
                               {"@agentic-toolkit/adh": None, "@agentic-toolkit/adh-registry": None}),
      "@agentic-toolkit/adh")
check("a same-prefix stranger matches nothing",
      guard.imports_vocabulary("@agentic-toolkit/adhesive", {"@agentic-toolkit/adh": None}), None)

# (7) Every import form, since a guard that catches only `from` is a guard with
#     three holes in it.
FORMS = {
    "from": "import { a } from '@agentic-toolkit/adh'\n",
    "re-export": "export { a } from '@agentic-toolkit/adh'\n",
    "side-effect": "import '@agentic-toolkit/adh/styles.css'\n",
    "dynamic": "const m = await import('@agentic-toolkit/adh')\n",
    "require": "const m = require('@agentic-toolkit/adh')\n",
}
for form, body in FORMS.items():
    with tempfile.TemporaryDirectory() as tmp:
        root = make_tree(tmp, {"mechanism-fixture/src/x.ts": body}, PKGS)
        check(f"caught in {form} form", len(guard.find_violations(root)), 1)

# (8) Doc-comment example imports are not dependencies — the toolkit's own JSDoc
#     shows consumers importing by name, and a guard that matched those could
#     never go green. But a TRAILING comment after real code must still count.
with tempfile.TemporaryDirectory() as tmp:
    root = make_tree(tmp, {
        "mechanism-fixture/src/doc.ts": "// import { A } from '@agentic-toolkit/adh'\n"
                         " * import { B } from '@agentic-toolkit/adh'\n"
                         "/* import { C } from '@agentic-toolkit/adh' */\n",
        "mechanism-fixture/src/real.ts": "import { D } from '@agentic-toolkit/adh' // still a real import\n",
    }, PKGS)
    v = guard.find_violations(root)
    check("comment lines are skipped, trailing comments are not",
          sorted(p.name for p, _, _, _ in v), ["real.ts"])

# ---------------------------------------------------------------- the exemption

# (9) The `@/` ban is ABSOLUTE — there is no scaffolding exemption any more. The
#     `site-templates/` lineage that had one was deleted in `8e6c123`, and a
#     dormant exemption is how a guard quietly stops guarding. A vocabulary
#     package reaching its own tier stays legitimate, and that is the only thing
#     this script forgives.
with tempfile.TemporaryDirectory() as tmp:
    root = make_tree(tmp, {
        "adh/src/uses-own-tier.ts": "import { SITES } from '@agentic-toolkit/adh-registry'\n",
        "adh/src/aliased.tsx": "import { Nav } from '@/components/nav'\n",
        "mechanism-fixture/src/x.ts": "import { Nav } from '@/components/nav'\n",
    }, PKGS)
    v = guard.find_violations(root)
    check("vocabulary may reach its own tier, but nobody may use @/",
          sorted((p.name, s) for p, _, s, _ in v),
          [("aliased.tsx", "@/components/nav"), ("x.ts", "@/components/nav")])

# (10) dist/ is scanned only when asked. adh's CI passes --include-dist because
#      the committed dist is what consumers actually resolve.
with tempfile.TemporaryDirectory() as tmp:
    root = make_tree(tmp, {
        "mechanism-fixture/dist/x.js": "import { a } from '@agentic-toolkit/adh'\n",
    }, PKGS)
    check("dist skipped by default", guard.find_violations(root), [])
    check("dist scanned with --include-dist",
          len(guard.find_violations(root, include_dist=True)), 1)

# (11) node_modules is pruned, not filtered — a vendored copy of a package must
#      not register as a vocabulary package nor as a source file.
with tempfile.TemporaryDirectory() as tmp:
    root = make_tree(tmp, {
        "mechanism-fixture/node_modules/@agentic-toolkit/adh-fake/package.json":
            '{"name": "@agentic-toolkit/adh-fake"}',
        "mechanism-fixture/node_modules/junk/src/x.ts": "import a from '@agentic-toolkit/adh'\n",
        "mechanism-fixture/src/ok.ts": "export const ok = 1\n",
    }, PKGS)
    check("node_modules contributes no packages",
          "@agentic-toolkit/adh-fake" in guard.vocabulary_packages(root), False)
    check("node_modules contributes no sources", guard.find_violations(root), [])

def test_a_stale_exemption_fails_the_guard():
    """An exemption matching no real violation is a lie the guard must not keep telling."""
    import subprocess
    import sys
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "packages"
        (root / "adh-thing" / "src").mkdir(parents=True)
        (root / "adh-thing" / "package.json").write_text(
            '{"name": "@agentic-toolkit/adh-thing"}', encoding="utf-8"
        )
        (root / "adh-thing" / "src" / "index.ts").write_text("export const a = 1\n", encoding="utf-8")
        (root / "clean" / "src").mkdir(parents=True)
        (root / "clean" / "package.json").write_text(
            '{"name": "@agentic-toolkit/clean"}', encoding="utf-8"
        )
        (root / "clean" / "src" / "index.ts").write_text("export const b = 2\n", encoding="utf-8")

        result = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).resolve().parent / "check_boundaries.py"),
                "--root",
                str(root),
                "--exempt",
                "packages/clean/src/index.ts",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 1, "guard accepted an exemption that matched no violation"
        assert "stale exemption" in (result.stdout + result.stderr)


def test_no_exempt_reports_what_the_exemption_list_hides():
    """The exemption list has to be re-derivable, or it is only a claim.

    `--exempt` appends, so no value of it means "none" -- which left the
    unsuppressed list reachable only by importing find_violations() and
    calling it by hand. `--no-exempt` is how a reviewer checks that
    boundary_exemptions.EXEMPT_FILES names the violations that actually
    exist, rather than trusting that it once did.
    """
    import subprocess
    import sys
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "packages"
        (root / "adh-thing" / "src").mkdir(parents=True)
        (root / "adh-thing" / "package.json").write_text(
            '{"name": "@agentic-toolkit/adh-thing"}', encoding="utf-8"
        )
        (root / "adh-thing" / "src" / "index.ts").write_text(
            "export const a = 1\n", encoding="utf-8"
        )
        #  A mechanism package reaching for adh vocabulary: a real violation,
        #  of exactly the shape the fifteen exempted files have.
        (root / "mech" / "src").mkdir(parents=True)
        (root / "mech" / "package.json").write_text(
            '{"name": "@agentic-toolkit/mech"}', encoding="utf-8"
        )
        (root / "mech" / "src" / "index.ts").write_text(
            "import { a } from '@agentic-toolkit/adh-thing'\nexport const b = a\n",
            encoding="utf-8",
        )

        guard = str(Path(__file__).resolve().parent / "check_boundaries.py")
        offender = "packages/mech/src/index.ts"

        def run(*extra):
            return subprocess.run(
                [sys.executable, guard, "--root", str(root), *extra],
                capture_output=True,
                text=True,
            )

        exempted = run("--exempt", offender)
        assert exempted.returncode == 0, (
            "the fixture's exemption did not suppress its violation, so this "
            f"test proves nothing about --no-exempt: {exempted.stdout}{exempted.stderr}"
        )

        bare = run("--no-exempt")
        assert bare.returncode == 1, "--no-exempt hid a violation it was asked to show"
        assert offender in (bare.stdout + bare.stderr), (
            "--no-exempt exited 1 without naming the suppressed file"
        )
        assert "stale exemption" not in (bare.stdout + bare.stderr), (
            "--no-exempt must report violations, not accuse an empty list of being stale"
        )


test_a_stale_exemption_fails_the_guard()
test_no_exempt_reports_what_the_exemption_list_hides()

fails = [(n, g, w) for n, g, w in cases if g != w]
for n, g, w in fails:
    print(f"FAIL {n}: got {g!r} want {w!r}")
print(f"{len(cases) - len(fails)}/{len(cases)} checks passed")
sys.exit(1 if fails else 0)
