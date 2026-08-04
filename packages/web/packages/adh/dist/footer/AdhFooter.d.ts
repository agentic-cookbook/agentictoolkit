import type { MouseEvent, ReactNode } from 'react';
export type FooterLink = 
/** A real navigation link. `onSelect` is optional progressive enhancement: it runs on a
 *  plain left-click and may `preventDefault()` to handle the click itself. The `href`
 *  stays in the server HTML either way, so the link is never dead without JS.
 *  `prefetch` is passed straight through to next/link — leave it `undefined` to keep
 *  Next's own default (host decides per-link; the toolkit takes no position). */
{
    label: string;
    href: string;
    onSelect?: (event: MouseEvent<HTMLAnchorElement>) => void;
    prefetch?: boolean;
}
/** A native popover trigger: `popovertarget` opens the panel with NO client JS. Carries
 *  the `adh-footer__sites-trigger` class, which a host stylesheet may use to hide it in
 *  browsers without the Popover API — where it cannot degrade to anything. */
 | {
    label: string;
    popoverTarget: string;
    ariaLabel?: string;
};
export type AdhFooterProps = {
    links?: FooterLink[];
    copyright?: ReactNode;
    /** Build identity, rendered INSIDE the container and BEFORE the links nav, so
     *  the navigable items (Sites / Terms / Privacy) sit at the bar's trailing edge
     *  and the version reads as metadata trailing the copyright. Deliberately a prop
     *  and not an env read: this is the registry-free primitive and stays free of adh
     *  knowledge — the host decides what a version even is. */
    version?: ReactNode;
    trailing?: ReactNode;
};
export declare function AdhFooter({ links, copyright, version, trailing }: AdhFooterProps): import("react").JSX.Element;
//# sourceMappingURL=AdhFooter.d.ts.map