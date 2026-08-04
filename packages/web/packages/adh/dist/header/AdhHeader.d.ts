import { type ReactNode } from 'react';
import { type AvatarMenuUser } from './AvatarMenu';
import { type SiteLink } from './SiteOptionsMenu';
import { type NavLink } from './NavLink';
import type { AdhThemeKey } from '../themes/adh-themes';
/** A small pill shown under the site name. `tone` selects its colour. */
export type HeaderBadge = {
    label: string;
    tone?: 'neutral' | 'accent' | 'orange' | 'blue';
};
/** The whole family is a pre-launch preview, and every header says so in the strip
 *  above the bar. A DEFAULT, not a fixture — `previewNotice` overrides it, so the words
 *  are reachable from the host rather than sealed into this package.
 *
 *  The default earns its place under the same carve-out the package's default
 *  accessible names get: 46 sites all saying the same sentence should not each restate
 *  it, and a header that rendered nothing until every host was updated would ship 46
 *  sites with no notice at all. What must not happen is the words being UNREACHABLE
 *  from the host — the package owns the UI, the host owns the words.
 *
 *  This replaced a `Preview Release` BADGE under the site name. A badge sat inside
 *  the bar's lead slot, so it competed with the brand for the one part of the header
 *  that has to survive a 390px phone; a full-width strip above the bar costs the bar
 *  no horizontal room at all, and reads as a property of the site rather than of its
 *  name. */
export declare const DEFAULT_PREVIEW_NOTICE = "Developer Preview Release";
/** The auth-related slice of the header's props. An auth-aware wrapper in the
 *  consuming app supplies these from its auth source while the non-auth props are
 *  passed straight through. Kept as a named type so the source contract and the
 *  header can't drift apart — add an auth prop here and a derived type such as
 *  `HeaderAuthState` picks it up automatically. */
export type AdhHeaderAuthProps = {
    /** Transform a cross-site switcher destination href before use. Supplied by the
     *  auth-aware header when signed in, to route the switch through a silent SSO
     *  redirect so the target lands already logged in.
     *
     *  Consumed by a CALLER-SUPPLIED `siteSwitcher` (a registry-driven menu), not
     *  by the default switcher below — it lives on this type so the whole auth
     *  slice stays one object that a wrapper can forward in a single spread. */
    resolveSwitchHref?: (defaultHref: string) => string;
    user?: AvatarMenuUser | null;
    /** Auth is still resolving (the source's `isLoading`). While true the auth
     *  cluster shows a spinner instead of the login buttons, so a session resolving
     *  in the background never flashes "login / join" first. Defaults false. */
    authLoading?: boolean;
    /** The signed-in user holds the host app's `admin` capability. Forwarded to a
     *  caller-supplied site switcher, where a registry-driven menu can use it to
     *  unlock an admin-only tail in EVERY env — production included. Ignored by the
     *  default switcher. */
    userIsAdmin?: boolean;
    loginHref?: string;
    signupHref?: string;
    onLogin?: () => void;
    onSignup?: () => void;
    onLogout?: () => void;
    settingsHref?: string;
    onSettings?: () => void;
};
export type AdhHeaderProps = AdhHeaderAuthProps & {
    /** The current site's display name — the default switcher's trigger text. */
    siteName: string;
    /** Where the site name points when there is nowhere to switch to. */
    siteNameHref?: string;
    /** Switch targets for the DEFAULT switcher. Ignored when `siteSwitcher` is set.
     *  This component performs no registry lookup: whoever knows the site family
     *  hands the list in. */
    sites?: SiteLink[];
    /** Rewrite a chosen target's href before navigating (default switcher only).
     *  Receives the target's `id`, or its `href` when it has no `id`. */
    onSwitchSite?: (idOrHref: string) => string | undefined;
    /** Replaces the default `sites`-driven switcher in the header's lead slot.
     *
     *  This is the seam that keeps the header registry-free: a consumer whose site
     *  switcher must resolve a private registry (recents, workspaces, dev-tools
     *  flyouts) renders it itself and passes it here, from its own package. The
     *  default and the slot are mutually exclusive by
     *  construction: when this is set the default is not rendered at all. */
    siteSwitcher?: ReactNode;
    /** Optional page/section title, shown centered in the bar. */
    pageTitle?: string;
    /** Optional interactive content centered in the bar (e.g. a live status
     *  indicator + refresh). Unlike `pageTitle` it accepts arbitrary nodes and stays
     *  clickable. When set it occupies the centre slot in place of `pageTitle`. */
    center?: ReactNode;
    /** Badges shown under the site name. Empty by default — the family-wide preview
     *  notice is the strip above the bar, not a badge. */
    badges?: HeaderBadge[];
    /** Site-specific controls injected at the start (left) of the right-hand
     *  cluster, before the nav links + auth. Used for functional controls a site
     *  needs in the bar (e.g. a cookbook's search/sidebar/theme). */
    leadingActions?: ReactNode;
    navLinks?: NavLink[];
    trailingNavLinks?: NavLink[];
    /** Prominent links rendered AFTER the primary nav links and BEFORE the auth
     *  cluster — a distinct slot from `navLinks`, because the position is behavior:
     *  it is the last thing a signed-out visitor reads before "login / join", and it
     *  sits outside `.adh-header__links`, so it survives the phone breakpoint that
     *  collapses the primary nav into the site menu.
     *
     *  A consumer whose site family gives some of its sites one extra prominent
     *  link fills this. The predicate that decides WHICH sites get one, and what
     *  the link says, is the consumer's own vocabulary and stays with the caller;
     *  the header only knows there is a slot here. */
    preAuthLinks?: ReactNode;
    /** Where the avatar menu's "Home" points — the site's own post-login landing.
     *  This header resolves no site ids, so whoever knows the registry hands it in;
     *  defaults to the site root. */
    homeHref?: string;
    /** The words in the full-width strip above the bar. Defaults to
     *  {@link DEFAULT_PREVIEW_NOTICE}. The package draws the strip; the host supplies
     *  what it says.
     *
     *  The words only — there is deliberately no value that REMOVES the strip. Its
     *  height is `--adh-header-preview-height`, and `--adh-header-height` (which every
     *  sticky sidebar in the family offsets by) is `calc()`ed from it on `:root`. A prop
     *  that emptied the markup would leave that sum untouched, so every one of those
     *  sidebars would sit 1.125rem too low with nothing to say why. Retiring the strip is
     *  that token going to `0` and this default going away together — one coordinated
     *  change, not a per-host switch. */
    previewNotice?: string;
    /** The active theme key. Presentational hosts may key styling off it. */
    themeKey?: AdhThemeKey;
};
export declare function AdhHeader({ siteName, siteNameHref, sites, onSwitchSite, siteSwitcher, pageTitle, center, badges, leadingActions, navLinks, trailingNavLinks, preAuthLinks, homeHref, previewNotice, user, authLoading, loginHref, signupHref, onLogin, onSignup, onLogout, settingsHref, onSettings, }: AdhHeaderProps): import("react").JSX.Element;
//# sourceMappingURL=AdhHeader.d.ts.map