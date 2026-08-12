#!/usr/bin/env python3
"""Regression tests for tools/check-settings-boundary.py.

The guard reads BUILT dist/ output looking for three boundaries that were fixed
fail-open (see the guard's own module docstring, "fix-round-1" + the whole-branch
review): `first_directive()` used to read a file whose first line was a comment as
having NO directive, even when a real directive followed it; the two `.d.ts`
assertions used to be `if X.is_file()` and answered "clean" for a dist that was
never type-built; and the static-re-anchor scan used to cover only
dist/settings/index.js, not every emitted file, so a re-anchoring re-export
planted anywhere else on the fleet-wide chunk graph passed silently. Each of
those is a check that USED TO be unable to fail — so every case below proves
BOTH directions: a correct tree passes, and a specific mutation of it fails,
naming the thing that broke.

Plain asserts, no framework, real temp trees with a synthetic dist/ tree (the
module-level PKG/DIST/INDEX_JS/... constants are swapped for the duration of a
run, the same technique tools/shared_vendor_test.py uses for its PACKAGES global).
Run: python3 tools/check-settings-boundary_test.py   (exit 0 = pass).
"""
import contextlib
import importlib.util
import io
import tempfile
from pathlib import Path

_p = Path(__file__).resolve().parent / "check-settings-boundary.py"
_spec = importlib.util.spec_from_file_location("check_settings_boundary", _p)
m = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m)

cases: list[tuple[str, object, object]] = []


def check(name, got, want):
    cases.append((name, got, want))


LAZY_IMPORT = '"@agentic-toolkit/adh/settings/UserSettingsOverlay"'  # quoted, as it appears in dist


def panel_markers_text() -> str:
    return "".join(f"const {name} = 1;\n" for name in m.PANEL_MARKERS)


def topics_runtime_body() -> str:
    names = ",\n  ".join(m.TOPIC_RUNTIME_EXPORTS)
    return (
        "const SETTINGS_TOPICS = [];\n"
        "const DEFAULT_SETTINGS_TOPIC = 'x';\n"
        "function resolveSettingsTopic() {}\n"
        f"export {{\n  {names}\n}};\n"
    )


# A clean dist/settings/ tree, plus three OTHER always-loaded entries
# (dist/layout/index.js, dist/header/index.js, dist/index.js) that every one of the
# fleet's ~45 sites also loads on every page — exactly the files check 3's docstring
# names as plausible places for a re-anchoring re-export to hide.
CLEAN: dict[str, str] = {
    "dist/settings/index.js": (
        "'use client';\n"
        f'import({LAZY_IMPORT});\n'
        "const SettingsOverlayProvider = 1;\n"
        "export {\n  SettingsOverlayProvider\n};\n"
    ),
    "dist/settings/UserSettingsOverlay.js": (
        "'use client';\n" + panel_markers_text() +
        "export {\n  UserSettingsOverlay\n};\n"
    ),
    "dist/settings/topics.js": topics_runtime_body(),
    "dist/settings/index.d.ts": (
        "declare const SettingsOverlayProvider: unknown;\n"
        "export {\n  SettingsOverlayProvider\n};\n"
    ),
    "dist/settings/topics.d.ts": (
        "declare const SETTINGS_TOPICS: readonly string[];\n"
        "declare const DEFAULT_SETTINGS_TOPIC: string;\n"
        "declare function resolveSettingsTopic(): string;\n"
        "type SettingsTopicId = string;\n"
        "export {\n  SETTINGS_TOPICS,\n  DEFAULT_SETTINGS_TOPIC,\n  resolveSettingsTopic,\n"
        "  SettingsTopicId\n};\n"
    ),
    "dist/settings/UserSettingsOverlay.d.ts": (
        "declare const UserSettingsOverlay: unknown;\n"
        "export {\n  UserSettingsOverlay\n};\n"
    ),
    "dist/layout/index.js": "const Layout = 1;\nexport {\n  Layout\n};\n",
    "dist/header/index.js": "const Header = 1;\nexport {\n  Header\n};\n",
    "dist/index.js": "const Root = 1;\nexport {\n  Root\n};\n",
}


@contextlib.contextmanager
def tree(spec: dict[str, str]):
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for rel, text in spec.items():
            path = root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        yield root


def run(spec: dict[str, str]) -> tuple[object, str]:
    """Run main() against a synthetic package root; return (exit code, combined output).

    The exit code is `object`, not `int`: the very-first gate (dist/settings/ absent)
    calls `sys.exit(<message string>)` directly, so a code of that shape is itself part
    of what a caller below asserts on.
    """
    with tree(spec) as root:
        saved = (m.PKG, m.DIST, m.INDEX_JS, m.OVERLAY_JS, m.TOPICS_JS, m.TOPICS_DTS, m.INDEX_DTS)
        m.PKG = root
        m.DIST = root / "dist" / "settings"
        m.INDEX_JS = m.DIST / "index.js"
        m.OVERLAY_JS = m.DIST / "UserSettingsOverlay.js"
        m.TOPICS_JS = m.DIST / "topics.js"
        m.TOPICS_DTS = m.DIST / "topics.d.ts"
        m.INDEX_DTS = m.DIST / "index.d.ts"
        out, err = io.StringIO(), io.StringIO()
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                try:
                    code = m.main()
                except SystemExit as exc:
                    code = exc.code
        finally:
            (m.PKG, m.DIST, m.INDEX_JS, m.OVERLAY_JS, m.TOPICS_JS,
             m.TOPICS_DTS, m.INDEX_DTS) = saved
        return code, out.getvalue() + err.getvalue()


def mutate(changes: dict[str, str]) -> dict[str, str]:
    """CLEAN with the given relative paths overwritten or added."""
    spec = dict(CLEAN)
    spec.update(changes)
    return spec


def drop(*keys: str) -> dict[str, str]:
    return {k: v for k, v in CLEAN.items() if k not in keys}


FIRST_MARKER = m.PANEL_MARKERS[0]
FIRST_TOPIC = m.TOPIC_RUNTIME_EXPORTS[0]

# ───────────────────────────── the clean baseline ─────────────────────────────
# If this is not clean the mutations below prove nothing.
_ok_code, _ok_msg = run(CLEAN)
check("a fully correct dist passes", _ok_code, 0)
check("...and reports ok", "settings-boundary: ok" in _ok_msg, True)

# ───────────────────── first_directive: comments must not hide a directive ─────────────────────
# The bug: reading line-by-line and skipping only blanks/`//` returned None for any file
# whose first line was `/*` — even when a real directive followed the comment. That is the
# exact shape of "server-safe file" the guard reads a client-tainted one as. Tested both at
# the function level (both comment kinds, plus the edge cases around them) and end-to-end
# through main() against topics.js, the one file this decides server-safety for.


def directive_of(text: str) -> str | None:
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "f.js"
        p.write_text(text, encoding="utf-8")
        return m.first_directive(p)


check("a bare directive is read", directive_of("'use client';\nx();\n"), "use client")
check("a directive after a // line comment is read",
      directive_of("// banner\n'use client';\n"), "use client")
check("a directive after a /* */ block comment is read",
      directive_of("/* banner */\n'use client';\n"), "use client")
check("a directive after a MULTI-LINE block comment is read",
      directive_of("/* line one\n * line two\n */\n'use client';\n"), "use client")
check("no directive at all is None", directive_of("const x = 1;\n"), None)
check("an unterminated block comment leaves nothing to find",
      directive_of("/* this never closes\nconst x = 1;\n"), None)
check("a leading block comment with NO directive after it is still None (not a false alarm)",
      directive_of("/* just a banner */\nconst x = 1;\n"), None)

_client_after_block = mutate({
    "dist/settings/topics.js": "/* banner */\n'use client';\n" + topics_runtime_body(),
})
_code, _msg = run(_client_after_block)
check("main(): 'use client' after a BLOCK comment in topics.js is still caught", _code, 1)
check("...naming topics.js", "dist/settings/topics.js opens with" in _msg, True)

_client_after_line = mutate({
    "dist/settings/topics.js": "// banner\n'use client';\n" + topics_runtime_body(),
})
_code, _msg = run(_client_after_line)
check("main(): 'use client' after a LINE comment in topics.js is still caught", _code, 1)
check("...naming topics.js", "dist/settings/topics.js opens with" in _msg, True)

_comment_only = mutate({
    "dist/settings/topics.js": "/* just a banner, no directive */\n" + topics_runtime_body(),
})
check("main(): a leading comment with no directive still reads topics.js as server-safe",
      run(_comment_only)[0], 0)

_bare_client = mutate({"dist/settings/topics.js": "'use client';\n" + topics_runtime_body()})
_code, _msg = run(_bare_client)
check("main(): topics.js opening with a bare 'use client' fails (the taint rule itself)", _code, 1)
check("...naming topics.js", "dist/settings/topics.js opens with" in _msg, True)

# ───────────────────────── the .d.ts assertions are REQUIRED, not optional ─────────────────────────
# The bug: `if X.is_file()` answered "clean" for a dist that was never type-built. The fix
# makes both .d.ts files unconditionally required, alongside the three .js entries.
_code, _msg = run(drop("dist/settings/index.d.ts", "dist/settings/topics.d.ts"))
check("main(): a dist NEVER type-built (both .d.ts absent) FAILS, not clean", _code, 1)
check("...naming index.d.ts", "index.d.ts was not built" in _msg, True)
check("...naming topics.d.ts", "topics.d.ts was not built" in _msg, True)

_code, _msg = run(drop("dist/settings/index.d.ts"))
check("main(): index.d.ts alone missing still fails", _code, 1)
check("...naming index.d.ts", "index.d.ts was not built" in _msg, True)

_code, _msg = run(drop("dist/settings/topics.d.ts"))
check("main(): topics.d.ts alone missing still fails", _code, 1)
check("...naming topics.d.ts", "topics.d.ts was not built" in _msg, True)

# The .js required entries too, for completeness of the same gate.
_code, _msg = run(drop("dist/settings/UserSettingsOverlay.js"))
check("main(): a missing UserSettingsOverlay.js fails the required-files gate", _code, 1)
check("...naming it", "UserSettingsOverlay.js was not built" in _msg, True)

_code, _msg = run({})
check("main(): dist/settings/ missing entirely is rejected, not silently skipped",
      "dist/settings/ is missing at" in str(_code), True)

# ─────────────────────── check 1: the lazy boundary (panel graph placement) ───────────────────────
_leak = mutate({
    "dist/settings/index.js": CLEAN["dist/settings/index.js"].replace(
        "const SettingsOverlayProvider = 1;",
        "const SettingsOverlayProvider = 1;\n" + panel_markers_text()),
})
_code, _msg = run(_leak)
check("main(): a panel marker leaking into index.js fails", _code, 1)
check("...naming the leaked marker", FIRST_MARKER in _msg, True)

_missing_overlay = mutate({
    "dist/settings/UserSettingsOverlay.js": CLEAN["dist/settings/UserSettingsOverlay.js"].replace(
        f"const {FIRST_MARKER} = 1;\n", ""),
})
_code, _msg = run(_missing_overlay)
check("main(): a panel marker missing from the overlay entry fails", _code, 1)
check("...naming the missing marker", FIRST_MARKER in _msg, True)

_no_lazy = mutate({
    "dist/settings/index.js": CLEAN["dist/settings/index.js"].replace(f"import({LAZY_IMPORT});\n", ""),
})
_code, _msg = run(_no_lazy)
check("main(): a missing lazy import() call in index.js fails", _code, 1)
check("...saying so", "does not contain a literal" in _msg, True)

# ─────────────── check 3: the static re-anchor scan covers EVERY emitted file ───────────────
# The bug that shipped ("1b" in the guard's docstring): a static re-export of the overlay
# specifier defeats the lazy split even while check 1 stays green, and the original scan
# only looked at dist/settings/index.js. These plant the SAME static re-export in a
# DIFFERENT always-loaded entry — dist/layout/index.js and the root dist/index.js — files
# that ship on every page of all ~45 sites exactly like the barrel does.
_static_in_barrel = mutate({
    "dist/settings/index.js": CLEAN["dist/settings/index.js"] +
        f'export {{ UserSettingsOverlay }} from {LAZY_IMPORT};\n',
})
_code, _msg = run(_static_in_barrel)
check("main(): a static re-export inside dist/settings/index.js itself is caught", _code, 1)
check("...naming index.js", "dist/settings/index.js names" in _msg, True)

_static_in_layout = mutate({
    "dist/layout/index.js": CLEAN["dist/layout/index.js"] +
        f'export {{ UserSettingsOverlay }} from {LAZY_IMPORT};\n',
})
_code, _msg = run(_static_in_layout)
check("main(): a static re-export in a DIFFERENT always-loaded entry (layout) is caught", _code, 1)
check("...naming dist/layout/index.js, not settings/index.js",
      "dist/layout/index.js names" in _msg, True)

_static_in_root = mutate({
    "dist/index.js": CLEAN["dist/index.js"] +
        f'export {{ UserSettingsOverlay }} from {LAZY_IMPORT};\n',
})
_code, _msg = run(_static_in_root)
check("main(): a static re-export in the ROOT dist/index.js (loaded on every page) is caught",
      _code, 1)
check("...naming dist/index.js", "dist/index.js names" in _msg, True)

_static_dts_elsewhere = mutate({
    "dist/layout/index.d.ts": f'export {{ UserSettingsOverlay }} from {LAZY_IMPORT};\n',
})
_code, _msg = run(_static_dts_elsewhere)
check("main(): the type-level sibling scan also covers a DIFFERENT entry's .d.ts", _code, 1)
check("...naming dist/layout/index.d.ts", "dist/layout/index.d.ts re-exports from" in _msg, True)

# ────────────── check 2: the topic constants reachable ONLY through settings/topics ──────────────
_internal_use = mutate({
    "dist/settings/uses-topics.js": (
        "'use client';\n"
        'import { SETTINGS_TOPICS } from "./topics.js";\n'
        "const first = SETTINGS_TOPICS[0];\n"
        "export {\n  first\n};\n"
    ),
})
check("main(): an entry that merely USES a topic constant internally is not flagged (no false positive)",
      run(_internal_use)[0], 0)

_republish_runtime = mutate({
    "dist/settings/leaky.js": (
        "'use client';\n"
        f"const {FIRST_TOPIC} = [];\n"
        f"export {{\n  {FIRST_TOPIC}\n}};\n"
    ),
})
_code, _msg = run(_republish_runtime)
check("main(): a client-tainted entry republishing a topic constant fails", _code, 1)
check("...naming the file", "dist/settings/leaky.js re-exports" in _msg, True)
check("...naming the constant", FIRST_TOPIC in _msg, True)

_republish_types = mutate({
    "dist/settings/leaky.d.ts": (
        "type SettingsTopicId = string;\n"
        "export {\n  SettingsTopicId\n};\n"
    ),
})
_code, _msg = run(_republish_types)
check("main(): a .d.ts republishing the type-only SettingsTopicId fails", _code, 1)
check("...naming the file", "dist/settings/leaky.d.ts re-exports" in _msg, True)

_export_star_js = mutate({
    "dist/settings/leaky.js": 'export * from "@agentic-toolkit/adh/settings/topics";\n',
})
_code, _msg = run(_export_star_js)
check("main(): a blanket `export * from settings/topics` in a JS file fails", _code, 1)
check("...naming the file", "dist/settings/leaky.js has" in _msg, True)

_export_star_dts = mutate({
    "dist/settings/leaky.d.ts": 'export * from "@agentic-toolkit/adh/settings/topics";\n',
})
_code, _msg = run(_export_star_dts)
check("main(): a blanket `export * from settings/topics` in a .d.ts fails", _code, 1)
check("...naming the file", "dist/settings/leaky.d.ts has" in _msg, True)

# exported_names() itself: judged on the parsed `export { … }` clause, not a substring scan.
def names_of(text: str) -> set[str]:
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "f.js"
        p.write_text(text, encoding="utf-8")
        return m.exported_names(p)


check("exported_names(): an export clause's names are collected",
      names_of("export {\n  SETTINGS_TOPICS,\n  DEFAULT_SETTINGS_TOPIC\n};\n"),
      {"SETTINGS_TOPICS", "DEFAULT_SETTINGS_TOPIC"})
check("exported_names(): an aliased export collects both sides",
      # The naive identifier regex over the raw clause also picks up the `as` keyword
      # itself — harmless (it is never one of the names any rule here checks for), but
      # real behavior, so the expectation includes it rather than papering over it.
      names_of("export {\n  SETTINGS_TOPICS as Topics\n};\n"),
      {"SETTINGS_TOPICS", "as", "Topics"})
check("exported_names(): internal USE of a name is not a republish (no false positive)",
      names_of("const x = SETTINGS_TOPICS.length;\nexport {\n  x\n};\n"),
      {"x"})

fails = [(n, g, w) for n, g, w in cases if g != w]
for n, g, w in fails:
    print(f"FAIL {n}: got {g!r} want {w!r}")
print(f"{len(cases) - len(fails)}/{len(cases)} checks passed")
raise SystemExit(1 if fails else 0)
