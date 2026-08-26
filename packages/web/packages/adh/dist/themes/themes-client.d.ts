import type { ThemeDelta } from '@agenticdevelopertoolkit/themes/tokens';
/** A theme as stored/returned by the backend — `data` is the delta from `basedOn`. */
export interface StoredTheme {
    key: string;
    label: string;
    basedOn: string | null;
    data: ThemeDelta;
    createdAt: string;
    updatedAt: string;
}
export interface ThemeWrite {
    label: string;
    basedOn?: string | null;
    data: ThemeDelta;
}
/** Every live theme (suite-wide). Empty in production, where the table is untouched;
 *  also [] on 404 so the editor degrades to the baked seeds against a backend that
 *  predates the /themes routes (rather than surfacing a spurious error). */
export declare function listThemes(): Promise<StoredTheme[]>;
export declare function createTheme(theme: ThemeWrite & {
    key: string;
}): Promise<StoredTheme>;
export declare function updateTheme(key: string, patch: Partial<ThemeWrite>): Promise<StoredTheme>;
export declare function deleteTheme(key: string): Promise<void>;
//# sourceMappingURL=themes-client.d.ts.map