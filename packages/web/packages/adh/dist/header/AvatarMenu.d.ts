export type AvatarMenuUser = {
    /** What this account is CALLED — the personal name when one is known, else the
     *  handle a source falls back to (hub's slug, the email local-part, 'User'; see
     *  `toAvatarUser`). Never empty by contract, which is why the trigger can use it
     *  as its accessible name and the avatar can derive initials from it. */
    name: string;
    /** The person's own name, when the backend actually holds one. Present ⇒ the menu
     *  GREETS by its first word; absent ⇒ it prints `name` plainly.
     *
     *  Two fields rather than one because a handle is not a name, and only the source
     *  knows which it handed over: greeting "Welcome mikefullerton!" is worse than
     *  printing the handle. `name` still equals this whenever a name exists, so no
     *  caller has to choose between them for a11y or initials. */
    fullName?: string;
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