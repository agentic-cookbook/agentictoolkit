import type { ComponentType } from 'react';
export type NavLinkIcon = ComponentType<any>;
export type NavLink = {
    label: string;
    href: string;
    matchPaths?: string[];
    icon?: NavLinkIcon;
};
export type NavLinkItemProps = {
    link: NavLink;
};
export declare function pathMatches(pathname: string, pattern: string): boolean;
export declare function NavLinkItem({ link }: NavLinkItemProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=NavLink.d.ts.map