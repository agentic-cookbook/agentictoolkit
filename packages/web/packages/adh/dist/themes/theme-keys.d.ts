import { type AdhThemeKey, type SwitcherThemeKey } from './adh-themes';
/**
 * The two theme-key sets that are DERIVED from the theme manifest, kept apart from
 * adh-themes.ts for one bundling reason.
 *
 * `@agentic-toolkit/themes/manifest` is a record of every registered theme with its
 * whole stylesheet inlined as a string — ~39 of them. This package builds with tsup's
 * `splitting: false`, so a module reached by an entry is INLINED into that entry, and
 * esbuild tree-shakes the unused declarations but keeps the `import` statement of an
 * EXTERNAL package (it cannot prove the package has no side effects; `@agentic-toolkit/
 * themes` does declare `sideEffects: ["**\/*.css"]`). So while these two functions lived
 * in adh-themes.ts, every entry that touched ANY constant in that file — `theme-preview`
 * wants one, `DEFAULT_SITE_THEME`, for the pre-paint script — emitted a live
 * `import { themes } from '@agentic-toolkit/themes/manifest'` and pulled all 39
 * stylesheets into the consumer's graph, with `themes` referenced nowhere in the module.
 *
 * The direction of the import below is therefore load-bearing: theme-keys → adh-themes,
 * never the reverse. adh-themes.ts must keep its manifest reference `import type` only,
 * so it erases; adding a value import of this file back into it would restore exactly
 * the graph this split exists to break.
 *
 * The DOM-reading counterpart of this rule is in the hub's ThemePickerRow, which reads
 * its menu off the emitted `<style data-adh-theme-alt>` nodes for the same reason.
 */
/** Every adh* theme key the switcher offers — the delta-over-base font variants,
 *  minus the BASE_CUT_ALIASES declared at the top of adh-themes.ts. */
export declare const adhThemeKeys: () => AdhThemeKey[];
/** Every switchable theme key — the set the switcher menu offers and AdhThemeStyle
 *  emits alt-blocks for. adh family (emitted as `:root` deltas) + full-palette themes
 *  (emitted whole). Single source so the menu and the emitted blocks can't diverge. */
export declare const switcherThemeKeys: () => SwitcherThemeKey[];
//# sourceMappingURL=theme-keys.d.ts.map