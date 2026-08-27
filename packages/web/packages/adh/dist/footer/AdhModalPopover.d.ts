import type { ReactNode } from 'react';
export type AdhModalPopoverProps = {
    /** DOM id — triggers open it via `popovertarget={id}` (or showPopover()). */
    id: string;
    /** Heading shown in the modal header (left of the close box). */
    title: string;
    children: ReactNode;
    /** Extra class on the scrollable body wrapper (e.g. for legal prose). */
    bodyClassName?: string;
};
/**
 * A modal dialog built on the native HTML Popover API (top layer + backdrop +
 * Escape + light-dismiss, all native), styled with a header (title + close box)
 * and a scrollable body. Used by the footer's Sites / Terms / Privacy triggers.
 *
 * Popover (not <dialog>) so it stays declarative — a `popovertarget` button opens
 * it and the header's `popovertargetaction="hide"` button closes it with no JS —
 * and so the header site-switcher keeps opening the sites overview via the same
 * id. role/aria make it announce as a modal dialog.
 */
export declare function AdhModalPopover({ id, title, children, bodyClassName }: AdhModalPopoverProps): import("react").JSX.Element;
//# sourceMappingURL=AdhModalPopover.d.ts.map