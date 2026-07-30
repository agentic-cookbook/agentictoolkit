export type ThemeSource = 'seed' | 'db';
/** A theme as the level-1 list sees it. */
export interface EditorTheme {
    key: string;
    label: string;
    basedOn: string | null;
    source: ThemeSource;
}
/** itemId → that item's free-form CSS block. */
export type CssMap = Record<string, string>;
export interface ThemeEditorApi {
    loading: boolean;
    error: string | null;
    /** Seeds + saved DB themes + (while creating) the unsaved draft — the level-1 list. */
    themes: EditorTheme[];
    selectedKey: string | null;
    isSeed: boolean;
    isNew: boolean;
    label: string;
    themeKey: string;
    basedOn: string | null;
    dirty: boolean;
    canSave: boolean;
    canDelete: boolean;
    saving: boolean;
    /** The free-form CSS for an item (level 3). */
    itemCss: (itemId: string) => string;
    select: (key: string | null) => void;
    setItemCss: (itemId: string, css: string) => void;
    setLabel: (label: string) => void;
    setThemeKey: (key: string) => void;
    newTheme: () => void;
    /** Persist; resolves true on success, false if it failed (error set). */
    save: () => Promise<boolean>;
    remove: () => Promise<void>;
    cancel: () => void;
    /** All item blocks concatenated — the full applied stylesheet (for export/copy). */
    exportCss: () => string;
}
/**
 * All theme-editor state + behavior in one hook (SRP: the UI is pure presentation).
 * The unit of edit is now a FREE-FORM CSS block per item; a theme's `data` is the
 * map of those blocks. Seeds are read-only bases (preview only); DB themes are
 * editable. Editing applies live (base seed + concatenated blocks); Save persists.
 */
export declare function useThemeEditor(): ThemeEditorApi;
//# sourceMappingURL=useThemeEditor.d.ts.map