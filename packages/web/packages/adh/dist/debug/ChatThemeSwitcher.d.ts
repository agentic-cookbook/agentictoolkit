export type ChatThemeOption = {
    key: string;
    label: string;
};
export type ChatThemeSwitcherProps = {
    /** The available chat themes (supplied by the host — keeps this admin-safe). */
    themes: ChatThemeOption[];
    /** The selected chat theme key, or `null` for the app default. */
    current: string | null;
    onChange: (key: string | null) => void;
    label?: string;
};
/**
 * A data-driven theme sub-menu for the chat surface. Mirrors the site
 * `ThemeSwitcher` but takes its theme list + current/onChange as props so the
 * shared debug menu never has to depend on the chat themes package directly.
 */
export declare function ChatThemeSwitcher({ themes, current, onChange, label, }: ChatThemeSwitcherProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ChatThemeSwitcher.d.ts.map