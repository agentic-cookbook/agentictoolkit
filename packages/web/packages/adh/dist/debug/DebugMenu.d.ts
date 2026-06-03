import type { AdhThemeKey } from '../themes/adh-themes';
import { type ChatThemeOption } from './ChatThemeSwitcher';
export type DebugMenuChat = {
    themes: ChatThemeOption[];
    current: string | null;
    onChange: (key: string | null) => void;
    label?: string;
};
export type DebugMenuProps = {
    /** Active site theme — sets the Theme sub-menu's current selection. */
    themeKey?: AdhThemeKey;
    /**
     * When provided, shows a chat-theme sub-menu. The host supplies this only
     * when the chat feature is enabled (AI_CHAT), keeping the menu admin-safe.
     */
    chat?: DebugMenuChat;
};
/**
 * A debug popup pinned to the upper-left of the viewport. The host mounts it on
 * every page (gated by DEBUG_MENU) in both the main and admin sites. It carries
 * the site theme switcher (moved here from the user menu) and, when enabled, a
 * chat-theme switcher.
 */
export declare function DebugMenu({ themeKey, chat }: DebugMenuProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DebugMenu.d.ts.map