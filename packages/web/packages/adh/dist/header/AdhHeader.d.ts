import { type AvatarMenuUser } from './AvatarMenu';
import { type SiteLink } from './SiteOptionsMenu';
import { type NavLink } from './NavLink';
import type { AdhThemeKey } from '../themes/adh-themes';
export type AdhHeaderProps = {
    siteName: string;
    siteNameHref?: string;
    /** Optional page/section title, shown centered in the bar. */
    pageTitle?: string;
    navLinks?: NavLink[];
    trailingNavLinks?: NavLink[];
    sites?: SiteLink[];
    user?: AvatarMenuUser | null;
    themeKey?: AdhThemeKey;
    loginHref?: string;
    signupHref?: string;
    onLogin?: () => void;
    onSignup?: () => void;
    onLogout?: () => void;
    settingsHref?: string;
    onSettings?: () => void;
};
export declare function AdhHeader({ siteName, siteNameHref, pageTitle, navLinks, trailingNavLinks, sites, user, loginHref, signupHref, onLogin, onSignup, onLogout, settingsHref, onSettings, }: AdhHeaderProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=AdhHeader.d.ts.map