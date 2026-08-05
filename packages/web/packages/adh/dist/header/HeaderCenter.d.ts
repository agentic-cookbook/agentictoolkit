import { type ReactElement, type ReactNode } from 'react';
/** Publishes the header's centre element to everything it wraps. Mounted by AdhAppShell so it
 *  covers the header AND the page — a provider around the page alone would never see the div. */
export declare function HeaderCenterProvider({ children }: {
    children: ReactNode;
}): ReactElement;
/** The header's centre element, or null — before mount, on the server, or with no provider. */
export declare function useHeaderCenter(): HTMLElement | null;
/** The ref callback AdhHeader hands its centre div. */
export declare function useHeaderCenterRegister(): (el: HTMLElement | null) => void;
/** Whether a HeaderCenterProvider is mounted above the calling component. See SiteHomeShell,
 *  which warns (dev-only) when it renders with no provider above it — the desktop chooser has
 *  nowhere to portal into and silently disappears above 768px. */
export declare function useHeaderCenterProvided(): boolean;
//# sourceMappingURL=HeaderCenter.d.ts.map