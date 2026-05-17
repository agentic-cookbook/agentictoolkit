# @agentic-cookbook/site-model

Pure data and view-model layer for documentation-style sites in the Agentic Cookbook family.

This package owns:

- **Types** — `SiteEntry`, `NavNode`, `HeadingEntry`, `SiteConfig` and related shapes describing site content and structure.
- **Data operations** — pure functions (`buildNavTree`, `slugToBreadcrumbs`, lookups, search index construction) with no React dependency.
- **View-model providers** — React contexts and hooks (`SiteConfigProvider`, `ContentProvider`, `LinkProvider`, `RouteProvider`, `useSearchState`) that expose the data to UI without binding it to any specific renderer.

The UI layers (`@agentic-cookbook/layout`, `@agentic-cookbook/controls`, `@agentic-cookbook/content`) consume this package and never define their own copies of these types or operations.

The current `reference-web-site` package remains the working reference implementation; `site-model` was extracted to make those abstractions usable across multiple sites without dragging the full reference site along.
