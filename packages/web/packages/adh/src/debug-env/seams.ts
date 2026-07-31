import type { ComponentType } from 'react'

// The two values the Debug console needs from its HOST rather than from this package.
//
// Both are things a generic toolkit cannot own: the first is the host's notion of a
// DEPLOYMENT ENVIRONMENT, the second is the host's own theme TAXONOMY (which surfaces of
// which pages are themeable, and what a live preview of each looks like). The toolkit
// renders them; the host supplies them. Same slot pattern as the footer's
// `trailing`/`links` and the header's `siteSwitcher`.
//
// They are PROPS, threaded from `DebugConsoleWindow` (this package's public entry for the
// console) down to the two panels that use them — deliberately not a React context, so a
// host that forgets one gets a type error rather than a silently empty panel.

/**
 * The host's environment-override store — read and write.
 *
 * Typed STRUCTURALLY (`string | null`, not the host's env union) on purpose: adh's
 * `SiteEnv` is its four deployment tiers, which is vocabulary this package must not
 * learn. The same widening the telemetry provider used for its hostname→env resolver.
 *
 * `useEnvOverride` is a hook, so the value passed must be a stable module-level function
 * reference — it is called unconditionally on every render of the Settings panel.
 */
export interface EnvOverrideSurface {
  useEnvOverride: () => string | null
  setEnvOverride: (env: string | null) => void
}

/** One themeable surface inside an area — only what the console itself reads. */
export interface DebugThemeItem {
  /** Stable key in the theme's `data` map, e.g. "global.header-title". */
  id: string
  /** Level-3 topic label. */
  label: string
  /** Overrides the area's example for this item (e.g. a header item shows the header). */
  Preview?: ComponentType
}

/** One theme AREA (level 2) and the items it contains (level 3). */
export interface DebugThemeArea {
  id: string
  label: string
  items: DebugThemeItem[]
  /** Default live example for the area's items (an item's own `Preview` wins). */
  Preview: ComponentType
}

/**
 * The host's theme-editor taxonomy + its CSS editor.
 *
 * `readItemCss` is keyed by item ID rather than taking the item object, so the host keeps
 * its richer item type (selectors, custom properties, fallback CSS) entirely to itself —
 * this package never has to model it, and the contract stays free of the variance problem
 * a shared item type would create.
 */
export interface ThemeAreasSurface {
  areas: DebugThemeArea[]
  /**
   * Live-read the CSS currently applied to `itemId`'s target, preferring an element
   * inside `scope` (the rendered example) over the live page. Returns the item's fallback
   * block when nothing can be read.
   */
  readItemCss: (itemId: string, scope: HTMLElement | null) => string
  /** The CSS editor to render for the selected item. */
  CssEditor: ComponentType<{ value: string; onChange: (value: string) => void }>
}

/**
 * How the console ASKS for {@link ThemeAreasSurface} — a loader, never the value.
 *
 * The surface is the heaviest thing the console touches (the host's whole preview
 * taxonomy, and a CSS editor that in adh's case is Monaco), and it is needed only by the
 * site-theme topic, which is already behind a build gate. Taking the value as a prop
 * meant the host had to BUILD it to render the console at all — and the console's own
 * chunk is unconditional, because a signed-in admin can open it in production. So the
 * taxonomy rode into every production build behind a gate that had already been passed.
 *
 * A loader moves the host's `import()` to a site the bundler can fold: the host writes the
 * env comparisons out inline around it and production never registers the import. See the
 * chunk-gate contract in adh-registry's deployment-env; `productionBundleGates.test.ts`
 * checks it.
 *
 * Still REQUIRED, and still a prop rather than a context: a host that forgets it gets a
 * type error. A host with no site-theme editor at all supplies a rejecting loader — the
 * console never calls it, because `rootTopicsFor` drops the topic in the same builds.
 */
export type ThemeAreasLoader = () => Promise<ThemeAreasSurface>
