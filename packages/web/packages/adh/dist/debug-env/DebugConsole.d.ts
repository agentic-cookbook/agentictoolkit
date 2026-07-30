import type { EnvOverrideSurface, ThemeAreasSurface } from './seams';
/**
 * The unified Debug console window — a backdrop-less {@link FloatingWindow} whose
 * {@link HierarchicalDetailView} stack hosts every debug topic (Settings / Environment /
 * Site theme / Chat theme), cascading or covered as the platform's hierarchical-view flag
 * decides. Fully controlled: the caller (the shared
 * SiteMenu's "Debug Options" row) owns `open` state and the dev-only/env gating —
 * this component has no trigger of its own and no runtime env check, so it renders
 * whatever the caller decides to show. The caller also INJECTS the two host surfaces
 * this package deliberately does not own: the environment-override store and the theme
 * taxonomy (see `./seams`).
 *
 * The heavy work (theme editor + env fetch) lives in {@link DebugConsoleBody}, which
 * only mounts while the window is open (FloatingWindow returns `null` when closed).
 */
export type DebugConsoleWindowProps = {
    open: boolean;
    onClose: () => void;
    /** The host's environment-override store — see {@link EnvOverrideSurface}. */
    envOverride: EnvOverrideSurface;
    /** The host's theme taxonomy + CSS editor — see {@link ThemeAreasSurface}. */
    themeAreas: ThemeAreasSurface;
};
export declare function DebugConsoleWindow({ open, onClose, envOverride, themeAreas, }: DebugConsoleWindowProps): import("react").JSX.Element;
//# sourceMappingURL=DebugConsole.d.ts.map