import type { ReactNode } from 'react';
import { type NavLink } from './NavLink';
export type AvatarMenuUser = {
    name: string;
    email?: string;
    imageUrl?: string;
};
export type AvatarMenuProps = {
    user: AvatarMenuUser;
    navLinks?: NavLink[];
    onLogout?: () => void;
    settingsHref?: string;
    onSettings?: () => void;
    children?: ReactNode;
};
export declare function AvatarMenu({ user, navLinks, onLogout, settingsHref, onSettings, children, }: AvatarMenuProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=AvatarMenu.d.ts.map