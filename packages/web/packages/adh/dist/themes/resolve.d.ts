import { type SwitcherThemeKey } from './adh-themes';
/** True when `key` names a baked switchable seed (an adh font-variant OR a
 *  full-palette theme) — i.e. a theme with a static alt-block that can serve as a
 *  base. DB themes are `basedOn` one of these. */
export declare function isSwitcherSeed(key: string | null): key is SwitcherThemeKey;
/** Concatenate a theme's per-item CSS blocks into the applied stylesheet (empties
 *  dropped). One definition, shared by the editor hook and the load-time applier. */
export declare function concatItemCss(data: Record<string, string>): string;
//# sourceMappingURL=resolve.d.ts.map