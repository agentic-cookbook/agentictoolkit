/**
 * adh's Debug console — the toolkit's generic console wired to adh's own environment
 * store and theme taxonomy.
 *
 * WHY THIS MODULE EXISTS. The console is MECHANISM and lives in the toolkit; the two
 * things it renders are adh VOCABULARY and live here. Something has to join them, and it
 * has to be a module the site menu can `next/dynamic`-import BY PACKAGE PATH: the menu sits
 * in the always-loaded `header/index` entry, so wiring the two surfaces up from there
 * directly would drag them onto every page. Behind this lazily fetched entry they stay
 * exactly as lazy as they were inside the pre-rename `@adh-shared/adh`, where the same code
 * was one un-split chunk.
 *
 * Lazy is NOT the same as absent, which is the distinction `themeAreas` above turns on:
 * this chunk is built for every env, so the taxonomy (and, through `CssEditor`, Monaco)
 * needs its own build gate on top of the laziness.
 *
 * The props are identical to the toolkit component's minus the two injected surfaces, so
 * the site menu's call site is unchanged.
 */
export declare function DebugConsoleWindow({ open, onClose }: {
    open: boolean;
    onClose: () => void;
}): import("react").JSX.Element;
//# sourceMappingURL=index.d.ts.map