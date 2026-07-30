# Content catalogs (the copy layer)

This is the *copy* half of the `@agentic-toolkit/adh-site-config` data package (the
*shape* is `../structure.json`). See the package [`../README.md`](../README.md) for
the overview.

- **`../structure.json`** — the locale-agnostic *shape* (ids, hierarchy, `siteId`,
  `accent`, `related`, `docs`). Never holds human copy.
- **`./<locale>.json`** — the *copy* for one locale, flat-keyed by node id
  (`label`, `kicker`, `blurb`, `detail`, `keyPoints`, `ctas`). `en.json` is the
  default and the source of truth for routes/SEO.
- **`./<ns>.<locale>.json`** — namespaced copy that is NOT concept content
  (`auth.en.json`, `help.en.json`). It rides in this directory for co-location only;
  every tool here discriminates on the dot, so these files are never mistaken for
  locales.

`@agentic-toolkit/adh` imports both halves, applies the TypeScript types, and
`assembleTree(...)` (in `packages/adh/src/concepts/assemble.ts`) merges them into the
`ConceptNode` tree every consumer reads (graph, `/details`, menu). Edit them by hand,
or visually in the **Content Studio** — an app in the adh repo
(`frontend/src/local/content-studio`, `dev.local suite start .` →
`https://content-studio.hub.dev.local`), which round-trips these exact files.

## Adding a language

The copy is already in the translator-friendly format, so a new locale is mostly a
data change. Run the tooling from the workspace root (`packages/web/`):

1. **Scaffold** it, seeded with the English source to translate from:
   ```
   python3 tools/extract-content.py new <locale>     # e.g. fr, pt-br
   ```
2. **Translate** `content/<locale>.json` in place (or in the studio's locale view).
   Track progress with `extract-content.py coverage`; hand off to a TMS with
   `extract-content.py flatten <locale>`.
3. **Register** the locale in code (in `@agentic-toolkit/adh`) — one edit each:
   - add the literal to `Locale` in `packages/adh/src/concepts/types.ts`;
   - import + add it to `catalogs` in `packages/adh/src/concepts/content/index.ts`.
   Assembly falls back to the default locale for anything a locale omits, and
   `tools/validate-content.py` enforces that a locale's keys are a subset of the
   default's.

## The `getLocale()` seam

`packages/adh/src/concepts/assemble.ts` exposes `getLocale()`, which returns the
default locale today. Wiring it to the request/render locale (and adding `[locale]`
route segments + a language switcher) is the remaining runtime step — **deliberately
deferred** until a second locale actually exists. Structure (ids, routes, layout
order, accents) is locale-invariant, so routes and SEO stay stable across languages.
