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


def make_tree(tmp: str, files: dict[str, str], packages: dict[str, str],
              prefix: str = "") -> Path:
    """packages: dir -> npm name. files: relative path -> contents.

    `prefix` nests the packages one or more levels below `packages/`, the way
    this repo's real `packages/web/packages/<pkg>` layout does, so a test can
    pass a `--root` deeper than the prefix an exemption key is written with.

    The `.git` marker is what `repo_root_for` finds: exemption keys are
    repo-root-relative, and a fixture without a checkout root is not the tree
    the guard is ever run against."""
    (Path(tmp) / ".git").mkdir(exist_ok=True)
    root = Path(tmp) / "packages"
    if prefix:
        root = root / prefix
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
        (Path(tmp) / ".git").mkdir()  # exemption keys are repo-root-relative
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
        (Path(tmp) / ".git").mkdir()  # exemption keys are repo-root-relative
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


#  ------------------------------------------------- the arguments CI passes
#
#  Every fixture above builds `root = <tmp>/packages` and writes exemption keys
#  in that shape, and none combines an exemption with --include-dist. Those two
#  blind spots were the whole bug: the suite reported 22/22 on a tree where the
#  guard's ONLY production invocation — adh's wrapper, `--root
#  <repo>/packages/web/packages --include-dist` — exited 1 in every mode, on 15
#  "stale" exemptions that were nothing of the kind. A green suite that never
#  runs the arguments production runs proves the guard can fail, never that it
#  can pass.


def _wrapper_shaped_tree(tmp: str, dist: "dict[str, str] | None" = None) -> Path:
    """adh's real layout: `<repo>/packages/web/packages/<pkg>/{src,dist}`.

    `mech` commits the same violation the fifteen exempted files do; `other` is
    a second mechanism package, so a per-package rule can be told apart from a
    blanket one. Returns the DEEP root adh's wrapper passes."""
    root = make_tree(
        tmp,
        {
            "adh-thing/src/index.ts": "export const a = 1\n",
            "mech/src/index.ts": "import { a } from '@agentic-toolkit/adh-thing'\n",
        },
        {
            "adh-thing": "@agentic-toolkit/adh-thing",
            "mech": "@agentic-toolkit/mech",
            "other": "@agentic-toolkit/other",
        },
        prefix="web/packages",
    )
    for rel, body in (dist or {}).items():
        f = root / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(body, encoding="utf-8")
    return root


def _run(root: Path, *extra):
    import subprocess

    return subprocess.run(
        [sys.executable,
         str(Path(__file__).resolve().parent / "check_boundaries.py"),
         "--root", str(root), *extra],
        capture_output=True, text=True,
    )


EXEMPT_MECH = "packages/web/packages/mech/src/index.ts"


def test_an_exemption_key_does_not_depend_on_how_deep_the_root_is():
    """The same key, from the shallow root and from the deep one.

    `repo_rel` used to be `path.relative_to(root.parent)`, which is only
    repo-root-relative when --root is the default. Two levels deeper it
    produced `packages/mech/src/index.ts`, matched no exemption, and every
    entry read as stale."""
    with tempfile.TemporaryDirectory() as tmp:
        deep = _wrapper_shaped_tree(tmp)
        shallow = Path(tmp) / "packages"

        deep_run = _run(deep, "--exempt", EXEMPT_MECH)
        assert deep_run.returncode == 0, (
            "the deep root adh's CI passes rejected the exemption written for it: "
            f"{deep_run.stdout}{deep_run.stderr}"
        )
        assert "stale exemption" not in (deep_run.stdout + deep_run.stderr)

        shallow_run = _run(shallow, "--exempt", EXEMPT_MECH)
        assert shallow_run.returncode == 0, (
            "the same exemption stopped matching from the default root: "
            f"{shallow_run.stdout}{shallow_run.stderr}"
        )


def test_an_exemption_covers_the_dist_echo_of_the_module_it_names():
    """tsup externalises workspace deps, so the specifier survives into
    `dist/index.js` — a filename no per-module exemption can name. Without
    dist coverage, --include-dist re-reports every accepted violation."""
    with tempfile.TemporaryDirectory() as tmp:
        root = _wrapper_shaped_tree(tmp, dist={
            "mech/dist/index.js": "import { a } from '@agentic-toolkit/adh-thing'\n",
        })
        bare = _run(root, "--exempt", EXEMPT_MECH)
        assert bare.returncode == 0, "src-only scan regressed"

        with_dist = _run(root, "--exempt", EXEMPT_MECH, "--include-dist")
        assert with_dist.returncode == 0, (
            "the dist echo of an exempted src module was reported as a fresh "
            f"violation: {with_dist.stdout}{with_dist.stderr}"
        )


def test_dist_coverage_is_per_package_and_per_specifier():
    """The dist rule must not become a blanket amnesty for dist/.

    A specifier no exempted src file imports, and the SAME specifier in a
    package that has no exemption at all, both stay reported — otherwise
    `--include-dist` would be worth less than not scanning dist."""
    with tempfile.TemporaryDirectory() as tmp:
        root = _wrapper_shaped_tree(tmp, dist={
            "mech/dist/index.js":
                "import { a } from '@agentic-toolkit/adh-thing'\n"
                "import { b } from '@agentic-toolkit/adh-thing/brand-new'\n",
            "other/dist/index.js": "import { a } from '@agentic-toolkit/adh-thing'\n",
        })
        run = _run(root, "--exempt", EXEMPT_MECH, "--include-dist")
        assert run.returncode == 1, (
            "an unexempted specifier in dist slipped through: "
            f"{run.stdout}{run.stderr}"
        )
        out = run.stdout + run.stderr
        assert "brand-new" in out, "a novel specifier in an exempt package's dist went unreported"
        assert "other/dist/index.js" in out, "a package with no exemption had its dist forgiven"
        assert "stale exemption" not in out


def test_a_tree_outside_a_checkout_cannot_be_judged():
    """No repo root, no key — so exit 2 (could not check), never 0 or 1.

    Guessing a root is how the original bug produced fifteen confident,
    wrong `stale exemption` lines."""
    with tempfile.TemporaryDirectory() as tmp:
        root = _wrapper_shaped_tree(tmp)
        (Path(tmp) / ".git").rmdir()
        run = _run(root, "--exempt", EXEMPT_MECH)
        assert run.returncode == 2, (
            f"judged an exemption list it had no key for: {run.stdout}{run.stderr}"
        )
        assert "repository root" in (run.stdout + run.stderr)


test_a_stale_exemption_fails_the_guard()
test_no_exempt_reports_what_the_exemption_list_hides()
test_an_exemption_key_does_not_depend_on_how_deep_the_root_is()
test_an_exemption_covers_the_dist_echo_of_the_module_it_names()
test_dist_coverage_is_per_package_and_per_specifier()
test_a_tree_outside_a_checkout_cannot_be_judged()

fails = [(n, g, w) for n, g, w in cases if g != w]
for n, g, w in fails:
    print(f"FAIL {n}: got {g!r} want {w!r}")
print(f"{len(cases) - len(fails)}/{len(cases)} checks passed")
sys.exit(1 if fails else 0)
