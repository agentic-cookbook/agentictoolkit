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
    /** The account's handle. Present ⇒ the menu offers Profile, pointing at this site's
     *  `/<slug>/profile`. Absent ⇒ the row does not render, which is correct rather than
     *  degraded: an account with no slug has no profile address to send anyone to. */
    slug?: string;
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
 * plus the four account destinations — Home, Profile, User Settings, Log out.
 *
 * It is an ACCOUNT menu, not a nav menu. A site's own destinations live in the bar
 * and in the site-name menu (the brand dropdown); routing them through here as well
 * grew this popup to the length of the site's whole feature list.
 *
 * **This menu is CLOSED at FIVE rows. Add nothing further** — no sixth row, no slot,
 * no prop that lets a host inject one. Not a workspace picker, not a theme toggle,
 * not a docs link, not a site-specific action. Everything proposed for here already
 * has a home: `AdhHeader`'s bar slots (`navLinks`, `trailingNavLinks`, `preAuthLinks`,
 * `leadingActions`) or `SiteMenu`, which is also where the bar's links go below
 * 768px. The rows are what was LEFT after this popup had absorbed the hub's whole
 * feature list and had to be emptied again; there is no threshold at which one more
 * is harmless, which is why the rule is a count and not a taste. Profile was added by
 * the repo owner's explicit instruction — which is the only way the count moves.
 * (Repo rule: `.claude/skills/project-guidelines/topics/ui-development.md`.)
 */
export declare function AvatarMenu({ user, homeHref, onLogout, settingsHref, onSettings, }: AvatarMenuProps): import("react").JSX.Element;
//# sourceMappingURL=AvatarMenu.d.ts.map