#!/usr/bin/env python3
"""Assert the User Settings entries' three boundaries survive into BUILT output.

All three are invisible to vitest, tsc and every other guard this package runs — each is
a fact about what tsup/esbuild actually emitted, not about the TypeScript source, which is
why this checks dist/ rather than src/. Fix-round-1 review findings, Task 7; boundary 3
added by the whole-branch review, which caught what boundaries 1 and 2 structurally
cannot.

1. THE LAZY BOUNDARY: the ~3,000 LOC of settings panels (registry.tsx and everything it
   assembles — AccountPanel, SecurityWorkspace, and the rest) must stay OUT of
   dist/settings/index.js, the barrel every one of the fleet's ~45 sites loads
   unconditionally just to get SettingsOverlayProvider. They belong ONLY in
   dist/settings/UserSettingsOverlay.js, reached by settings-overlay.tsx's real `lazy()`
   import — fetched for the first time when a user actually opens the overlay, never on
   initial page load. "Only caught incidentally" before this script existed: nothing
   previously inspected built output to confirm the split actually happened, as opposed to
   esbuild inlining the whole graph behind a lazy-init wrapper (which would still satisfy
   every other check in this package — tsc, vitest, verify-bundle-boundaries.py all reason
   about specifiers and source shape, not about which physical file a given line of code
   ends up in).

1b. THE LAZY BOUNDARY IS NOT ENOUGH ON ITS OWN, and this is the one that shipped: check 1
   passes for a barrel that merely POINTS at the overlay entry instead of inlining it —
   including when it points STATICALLY. It did. `export { UserSettingsOverlay,
   buildSettingsTopics, SettingsTab } from "@agentic-toolkit/adh/settings/
   UserSettingsOverlay"` sat one line below the `lazy()` import of the identical specifier,
   and under Turbopack (what every consuming site builds with) the static edge re-anchors
   that chunk in the EAGER graph, after which the dynamic import resolves to something
   already loaded. dist looked perfect; three real production builds (`recipes`,
   `notebook`, `status`) had panel-only strings in their eager <script src> chunks. This
   script cannot see a consumer's chunk graph — but the cause is one line in THIS dist, so
   check 3 below asserts that across EVERY emitted file the specifier appears only inside
   an `import(...)`. Every file, not just the barrel: the re-anchoring is a property of the
   edge, and `dist/layout/index.js`, `dist/header/index.js` and `dist/index.js` are loaded
   on every page of all ~45 sites too.

2. THE SERVER-SAFE ESCAPE HATCH: dist/settings/topics.js — the only route to
   SETTINGS_TOPICS/DEFAULT_SETTINGS_TOPIC/resolveSettingsTopic a Server Component may use
   (see settings/topics.ts's and settings/index.ts's own header comments) — must never
   itself open with 'use client', and no 'use client' entry (dist/settings/index.js
   genuinely needs the directive, for SettingsOverlayProvider) may RE-EXPORT those three
   names, which would make them reachable only through a client-tainted chunk. Judged on
   the emitted `export { … }` clause, so an entry that merely USES a topic constant
   internally is not accused of republishing it. esbuild-plugin-preserve-
   directives hoists a chunk's directive onto every entry that reaches it, but only when
   BUILDING — the `development` condition resolves to raw .ts source, where Next's own
   compiler applies 'use client' per file rather than hoisting it across a bundled chunk.
   So dev, vitest and every guard here stay green even when this regresses; only a
   production build (`import` condition -> dist) would fail, and only at the point some
   Server Component actually tries to use the tainted value.

Run from the package root (the `build` script does):
    python3 tools/check-settings-boundary.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
DIST = PKG / "dist" / "settings"
CLIENT_DIRECTIVE = "use client"

INDEX_JS = DIST / "index.js"
OVERLAY_JS = DIST / "UserSettingsOverlay.js"
TOPICS_JS = DIST / "topics.js"
TOPICS_DTS = DIST / "topics.d.ts"
INDEX_DTS = DIST / "index.d.ts"

# Identifiers that exist ONLY inside the panel graph registry.tsx assembles — never in
# index.ts or settings-overlay.tsx. Listed explicitly (not derived) so a future rename that
# drops one of these here without updating registry.tsx is itself a signal, not a silent gap.
PANEL_MARKERS = [
    "AccountPanel",
    "SecurityWorkspace",
    "SubscriptionPanel",
    "ProfilePanel",
    "ContactInfoPanel",
    "NotificationsWorkspace",
    "ArchivedPanel",
    "TokensPanel",
    "AssistantsPanel",
    "SocialLinksPanel",
    "AddressesPanel",
    "UsagePanel",
    "AppearancePanel",
]

# The three runtime exports the barrel must never carry — see settings/index.ts's own
# CORRECTNESS RULE comment. SettingsTopicId is a fourth, type-only name checked separately
# against the .d.ts, since a type export leaves no trace in emitted JS.
TOPIC_RUNTIME_EXPORTS = ["SETTINGS_TOPICS", "DEFAULT_SETTINGS_TOPIC", "resolveSettingsTopic"]


def first_directive(path: Path) -> str | None:
    """Return the leading directive of a built ESM file, if it has one.

    Comments are skipped BOTH kinds, including a multi-line `/* … */`. Line-by-line,
    skipping only blanks and `//`, this returned None for any file whose first line was
    `/*` — and a banner is one tsup option (or one bundler upgrade) away, at which point
    check 2 below stops testing anything: `None != "use client"` reads exactly like a
    server-safe file, so a client-tainted topics.js would pass silently. That is the same
    failure shape this whole script exists to catch, one level up.
    """
    text = path.read_text(encoding="utf-8")
    i, n = 0, len(text)
    while i < n:
        if text[i].isspace():
            i += 1
        elif text.startswith("//", i):
            end = text.find("\n", i)
            i = n if end == -1 else end + 1
        elif text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end == -1:
                return None  # unterminated: there is no code after it to carry a directive
            i = end + 2
        else:
            break
    if i < n and text[i] in "'\"":
        quote = text[i]
        end = text.find(quote, i + 1)
        if end != -1:
            return text[i + 1:end]
    return None


_EXPORT_CLAUSE = re.compile(r"\bexport\s+(?:type\s+)?\{([^}]*)\}")


def exported_names(path: Path) -> set[str]:
    """Names a built module PUBLISHES, read from its `export { … }` clauses.

    Deliberately not "does the name appear in the file". The rule below is about
    republishing, and an entry that legitimately USES a topic constant (or types a prop as
    SettingsTopicId) is not republishing it. A guard that cannot tell those apart fires on
    the first legitimate use, and a guard that fires wrongly gets deleted rather than fixed.
    Both sides of an `as` alias are collected, so a renamed re-export still counts.
    """
    names: set[str] = set()
    for clause in _EXPORT_CLAUSE.findall(path.read_text(encoding="utf-8")):
        names.update(re.findall(r"[A-Za-z_$][\w$]*", clause))
    return names


def main() -> int:
    if not DIST.is_dir():
        sys.exit(f"dist/settings/ is missing at {DIST} — run the build first.")

    failures: list[str] = []
    # The .d.ts files are REQUIRED, not checked-if-present. `build:types` runs immediately
    # before this script, so their absence means the type build did not run — and the two
    # assertions below that read them were written as `if X.is_file()`, i.e. they answered
    # "clean" for a dist that had never been type-built. Both boundaries have a type-only
    # sibling that emits no JS, so those are the only assertions covering them.
    required = {
        "index.js": INDEX_JS,
        "UserSettingsOverlay.js": OVERLAY_JS,
        "topics.js": TOPICS_JS,
        "index.d.ts": INDEX_DTS,
        "topics.d.ts": TOPICS_DTS,
    }
    for name, path in required.items():
        if not path.is_file():
            failures.append(f"dist/settings/{name} was not built (expected at {path})")
    if failures:
        print("settings-boundary: FAILED", file=sys.stderr)
        for f in failures:
            print(f"  ✗ {f}", file=sys.stderr)
        return 1

    index_text = INDEX_JS.read_text(encoding="utf-8")
    overlay_text = OVERLAY_JS.read_text(encoding="utf-8")

    # --- Check 1: the lazy boundary --------------------------------------------------
    found_in_index = [m for m in PANEL_MARKERS if m in index_text]
    if found_in_index:
        failures.append(
            f"dist/settings/index.js contains panel-graph identifiers {found_in_index} — "
            "the ~3,000 LOC of settings panels leaked into the always-loaded barrel instead "
            "of staying behind UserSettingsOverlay's lazy() split. Every one of the fleet's "
            "sites would now carry this in its initial bundle just for a menu row."
        )

    missing_in_overlay = [m for m in PANEL_MARKERS if m not in overlay_text]
    if missing_in_overlay:
        failures.append(
            f"dist/settings/UserSettingsOverlay.js is missing panel-graph identifiers "
            f"{missing_in_overlay} — either a panel moved out of registry.tsx's assembly "
            "without updating PANEL_MARKERS above, or the panel graph stopped building into "
            "this entry at all (which would make the check above pass for the wrong reason)."
        )

    lazy_import = '"@agentic-toolkit/adh/settings/UserSettingsOverlay"'
    if f"import({lazy_import})" not in index_text:
        failures.append(
            "dist/settings/index.js does not contain a literal "
            f'import({lazy_import}) call — settings-overlay.tsx\'s lazy() import either '
            "got inlined (the external/package-path pairing in tsup.config.ts broke) or was "
            "removed, either way losing the fleet-wide code-split this whole entry exists for."
        )

    # --- Check 3: NOTHING in this dist may name the overlay entry statically -----------
    # See "1b" in this module's docstring. A static `export … from` / `import … from` the
    # same specifier makes check 1 pass while the split is defeated downstream.
    #
    # Every emitted file, not just dist/settings/index.js. The re-anchoring is a property
    # of the EDGE, not of the file it lives in: a static specifier in dist/layout/index.js,
    # dist/header/index.js or the root dist/index.js — all of them loaded on every page of
    # all ~45 sites, and all of them plausible places for someone to re-publish the overlay
    # — pins the chunk in the eager graph exactly as the barrel's own line did. Scoped to
    # one file, this check was as narrow as the bug that got past it was accidental.
    for built in sorted(p for p in DIST.parent.rglob("*") if p.name.endswith(".js")):
        text = built.read_text(encoding="utf-8") if built != INDEX_JS else index_text
        static_reaches = text.replace(f"import({lazy_import})", "").count(lazy_import)
        if not static_reaches:
            continue
        where = built.relative_to(PKG).as_posix()
        failures.append(
            f"{where} names {lazy_import} {static_reaches} time(s) OUTSIDE a lazy "
            "import() — a static re-export/import of the overlay entry. That is invisible "
            "in this dist (the panels are still in their own file, so check 1 is green) and "
            "fatal one repository downstream: the static edge re-anchors the overlay chunk "
            "in every consuming site's EAGER graph, so ~45 sites ship the whole panel graph "
            "on every page for a dialog a signed-out visitor cannot open. Import "
            "'@agentic-toolkit/adh/settings/UserSettingsOverlay' at the one host that needs "
            "it instead of republishing it here."
        )

    # The type-level sibling, over every declaration file for the same reason.
    for decl in sorted(p for p in DIST.parent.rglob("*") if p.name.endswith(".d.ts")):
        if decl == OVERLAY_JS.with_suffix(".d.ts"):
            continue  # the entry's own declarations
        if lazy_import.strip('"') not in decl.read_text(encoding="utf-8"):
            continue
        failures.append(
            f"{decl.relative_to(PKG).as_posix()} re-exports from {lazy_import} — the "
            "type-level sibling of the check above. A type-only re-export emits no JS, but "
            "it advertises the heavy names as part of that entry's surface, which is how "
            "the runtime one gets re-added. Same fix."
        )

    # --- Check 2: the server-safe escape hatch ----------------------------------------
    topics_directive = first_directive(TOPICS_JS)
    if topics_directive == CLIENT_DIRECTIVE:
        failures.append(
            f"dist/settings/topics.js opens with '{CLIENT_DIRECTIVE}' — it must not. "
            "This is the one route a Server Component may use to reach SETTINGS_TOPICS/"
            "DEFAULT_SETTINGS_TOPIC/resolveSettingsTopic; if it's ever client-tainted there "
            "is no server-safe route left at all."
        )

    # Every CLIENT-TAINTED entry, not only dist/settings/index.js: the taint is a property
    # of the chunk, so any entry carrying 'use client' that RE-EXPORTS these names offers a
    # route to them that a Server Component cannot use, and the barrel is not the only entry
    # someone can add an `export … from "./topics"` to. Judged on the emitted `export { … }`
    # clause rather than a substring, so an entry that legitimately USES a topic constant
    # internally is not accused of republishing it.
    for built in sorted(p for p in DIST.parent.rglob("*") if p.name.endswith(".js")):
        if built == TOPICS_JS or first_directive(built) != CLIENT_DIRECTIVE:
            continue
        exported = exported_names(built)
        republished = [name for name in TOPIC_RUNTIME_EXPORTS if name in exported]
        if not republished:
            continue
        failures.append(
            f"{built.relative_to(PKG).as_posix()} re-exports {republished} — a "
            f"'{CLIENT_DIRECTIVE}' entry must not republish the topic constants (see "
            "settings/index.ts's CORRECTNESS RULE comment). esbuild-plugin-preserve-"
            "directives hoists a chunk's directive onto every entry that reaches it, so "
            "anything reachable ONLY through here is client-tainted in a production build "
            "even though topics.ts itself carries no directive. Import from "
            "'@agentic-toolkit/adh/settings/topics' directly instead."
        )

    # The type-only sibling of the rule above, over every declaration file: a type export
    # emits no JS at all, so this assertion is the ONLY thing covering it.
    topic_types = TOPIC_RUNTIME_EXPORTS + ["SettingsTopicId"]
    for decl in sorted(p for p in DIST.parent.rglob("*") if p.name.endswith(".d.ts")):
        if decl == TOPICS_DTS:
            continue
        republished = [name for name in topic_types if name in exported_names(decl)]
        if not republished:
            continue
        failures.append(
            f"{decl.relative_to(PKG).as_posix()} re-exports {republished} — the type-only "
            "sibling of the runtime check above. Same rule, same fix: import from "
            "'@agentic-toolkit/adh/settings/topics', not from another entry."
        )

    # `export * from "…/settings/topics"` republishes all four names at once and names none
    # of them, so neither loop above can see it.
    topics_specifier = '"@agentic-toolkit/adh/settings/topics"'
    for built in sorted(p for p in DIST.parent.rglob("*")
                        if p.name.endswith(".js") or p.name.endswith(".d.ts")):
        if built in (TOPICS_JS, TOPICS_DTS):
            continue
        if re.search(r"export\s*\*\s*from\s*" + re.escape(topics_specifier),
                     built.read_text(encoding="utf-8")):
            failures.append(
                f"{built.relative_to(PKG).as_posix()} has `export * from "
                f"{topics_specifier}` — a blanket republish of all four topic names, which "
                "is the same rule as the two checks above with none of the names spelled "
                "out. Re-export nothing; let callers import the topics entry."
            )

    if failures:
        print("settings-boundary: FAILED", file=sys.stderr)
        for f in failures:
            print(f"  ✗ {f}", file=sys.stderr)
        return 1

    entries = sum(1 for p in DIST.parent.rglob("*")
                  if p.name.endswith(".js") or p.name.endswith(".d.ts"))
    print(
        "settings-boundary: ok "
        f"(panel graph confined to UserSettingsOverlay.js, {len(PANEL_MARKERS)} markers; "
        "lazy import preserved in index.js, and across all "
        f"{entries} emitted files nothing names that entry statically or republishes the "
        "topic constants from a client chunk; topics.js is the sole server-safe route)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
