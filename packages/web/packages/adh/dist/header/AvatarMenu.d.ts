export type AvatarMenuUser = {
    /** The resolved display name — an auth source picks the precedence (hub uses
     *  `displayName || slug`, every source then falls back through the email
     *  local-part to 'User'; see `toAvatarUser`). Never empty by contract, which is
     *  why this menu can show it unconditionally. */
    name: string;
    imageUrl?: string;
};
export type AvatarMenuProps = {
    user: AvatarMenuUser;
    /** Where "Home" points. The site's own post-login landing, supplied by the
     *  registry-aware wrapper; defaults to the site root. */
    homeHref?: string;
    onLogout?: () => void;
    settingsHref?: string;
    onSettings?: () => void;
};
/**
 * The signed-in account menu: the avatar in the bar, and under it the user's name
 * plus the three account destinations — Home, Settings, Log out.
 *
 * It is an ACCOUNT menu, not a nav menu. A site's own destinations live in the bar
 * and in the site-name menu (the brand dropdown); routing them through here as well
 * grew this popup to the length of the site's whole feature list.
 */
export declare function AvatarMenu({ user, homeHref, onLogout, settingsHref, onSettings, }: AvatarMenuProps): import("react").JSX.Element;
//# sourceMappingURL=AvatarMenu.d.ts.map