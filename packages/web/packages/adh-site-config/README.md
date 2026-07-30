# @agentic-toolkit/adh-site-config — the ecosystem's shape + content

This is the **single source of truth** for how the whole Agentic Developer Hub is
organized and what every piece says. Two plain-JSON files, editable by hand or in
the Content Studio:

- **`structure.json`** — the *shape*: the concept taxonomy (ids, hierarchy,
  `siteId`, `accent`, `related`, `docs`). Locale-agnostic; never holds copy.
- **`content/<locale>.json`** — the *copy*: `label`, `kicker`, `blurb`, `detail`,
  `keyPoints`, `ctas`, flat-keyed by node id. `en.json` is the default + source of
  truth for routes/SEO. See [`content/README.md`](content/README.md) for i18n.

It drives, in one place: the landing concept-graph, the site menu's product topics,
the `/details` pages, and the docs cross-links.

## Editing

- **Visually:** the Content Studio — an app in the **adh** repo
  (`frontend/src/local/content-studio`), `dev.local suite start .` →
  `https://content-studio.hub.dev.local`. It round-trips these exact files across
  the submodule boundary.
- **By hand:** just edit the JSON. Two guards, split by what they can see:
  `python3 tools/validate-content.py` (from the workspace root, i.e.
  `packages/web/`) runs on build + in tests over the JSON alone — missing copy,
  dangling `related`, duplicate ids, orphan keys, non-empty `docs`;
  `packages/adh/src/__tests__/concepts.test.ts` covers the checks that need the
  TypeScript side — every `docs` slug resolving to a real help topic, every concept
  site focusing a node.
- **Add a language:** `python3 tools/extract-content.py new <locale>`
  (see [`content/README.md`](content/README.md)).

## How it reaches the sites

Pure data — **no build step**. `@agentic-toolkit/adh` imports these JSON files
(`@agentic-toolkit/adh-site-config/structure.json` + `content/<locale>.json`),
applies the TypeScript types in `packages/adh/src/concepts/`, and bundles the result
into the chrome package every site already consumes. So edits are injected at compile
time — nothing to wire per site.
