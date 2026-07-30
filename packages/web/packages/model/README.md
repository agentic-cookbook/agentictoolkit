# @agentic-toolkit/model

Pure data and view-model layer for documentation-style sites in the Agentic Cookbook family.

This package owns:

- **Types** — `SiteEntry`, `NavNode`, `HeadingEntry`, `SiteConfig` and related shapes describing site content and structure.
- **Data operations** — pure functions (`buildNavTree`, `slugToBreadcrumbs`, lookups, search index construction) with no React dependency.
- **View-model providers** — React contexts and hooks (`SiteConfigProvider`, `ContentProvider`, `LinkProvider`, `RouteProvider`, `useSearchState`) that expose the data to UI without binding it to any specific renderer.

The UI layers that consume this package — `@agentic-toolkit/controls` today — never define their own copies of these types or operations.

This package was extracted from the (since-deleted) `reference-web-site` template to make those abstractions usable across multiple sites without dragging the full reference site along. It outlived the template: `reference-web-site`, along with `@agentic-toolkit/layout` and `@agentic-toolkit/content`, was deleted in July 2026 once nothing imported it.

Note that `@agentic-toolkit/ui`'s HDV blocks (`blocks/doc-types.ts`) deliberately **re-declare** their own `HeadingEntry` and nav-node shapes rather than importing them from here. That is not an oversight — `ui` must not depend on `model`, both to keep `ui` at the bottom of the dependency graph and because HDV's node shape carries `headings`, which `NavNode` does not.
