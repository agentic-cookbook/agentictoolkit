#!/usr/bin/env python3
"""Files that import adh vocabulary from a package not itself named adh-*.

Added 2026-08-25, when @agentic-toolkit/adh-ui was carved out of ui. These
imports are not new — the vocabulary used to live inside `ui`, where the
mechanism/vocabulary rule could not see it. Naming the carve-out honestly made
a pre-existing violation visible, so it is listed here rather than hidden by
giving the package a neutral name.

The real fix is to rename these seven packages to adh-*, which is its own piece
of work. Until then: this list may SHRINK freely, and must never grow without a
deliberate decision. check_boundaries fails on an entry that no longer matches
anything, so a fixed file cannot leave a stale exemption behind.

## Each entry names a src/ file and covers that package's dist/ too

Only `src/` paths appear below, deliberately. tsup externalises workspace
dependencies, so each of these specifiers survives verbatim into its package's
bundled `dist/` — under a filename (`dist/index.js`) that no per-module
exemption could name. `check_boundaries.accepted_specifiers` therefore reads
the specifiers off the exempted src files and accepts those same specifiers
under that package's `dist/`, so `--include-dist` (which adh's CI passes, and
this repo's own lint does not) sees the same accepted set rather than
re-reporting all fifteen. One entry means "this import is accepted for this
module", in both trees; a specifier appearing in dist that no exempted src file
imports is still reported.
"""

EXEMPT_FILES: frozenset[str] = frozenset(
    {
        "packages/web/packages/data/src/ecosystems/ecosystem-invitations.ts",
        "packages/web/packages/features/authentication/src/StorageTokensSection.tsx",
        "packages/web/packages/features/ecosystem-config/src/StorageTokensPanel.tsx",
        "packages/web/packages/features/ecosystems/src/AdminNotesModal.tsx",
        "packages/web/packages/features/ecosystems/src/EcosystemDetail.tsx",
        "packages/web/packages/features/ecosystems/src/EcosystemForm.tsx",
        "packages/web/packages/features/ecosystems/src/EcosystemInvitationPanes.tsx",
        "packages/web/packages/features/ecosystems/src/EcosystemSettingsPane.tsx",
        "packages/web/packages/features/ecosystems/src/EcosystemsFeature.tsx",
        "packages/web/packages/features/ecosystems/src/NotesAndHistory.tsx",
        "packages/web/packages/features/organizations/src/NewOrganizationModal.tsx",
        "packages/web/packages/features/organizations/src/OrgSettingsPane.tsx",
        "packages/web/packages/features/personas/src/PersonaEditor.tsx",
        "packages/web/packages/features/personas/src/PersonasSection.tsx",
        "packages/web/packages/features/teams/src/TeamSettingsPane.tsx",
    }
)
