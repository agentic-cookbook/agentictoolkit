import type { ThemeKey } from '@agentic-toolkit/themes/manifest';
export declare const ADH_THEME_COOKIE = "adh-theme";
export type AdhThemeKey = Extract<ThemeKey, `adh${string}`>;
export type AdhThemeOption = {
    key: AdhThemeKey;
    label: string;
};
export declare const ADH_THEMES: AdhThemeOption[];
export declare const DEFAULT_ADH_THEME: AdhThemeKey;
//# sourceMappingURL=adh-themes.d.ts.map