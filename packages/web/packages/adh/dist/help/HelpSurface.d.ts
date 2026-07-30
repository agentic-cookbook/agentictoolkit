import type { ReactNode } from 'react';
/** Join a site `basePath` (no trailing slash; `''` or `/` = apex) with a base-relative slug. */
export declare function helpHref(basePath: string, slug: string): string;
/**
 * The server-rendered help master-detail for one route. `slug` is the active base-relative slug
 * (e.g. `quickstart`, `quickstart/oauth/authorize`, `reference/errors`); `basePath` is where the
 * surface is mounted (`''` on the help site). `chatSlot` is the client chat island the host app
 * supplies for the `chat` topic (kept in the app so its backend wiring stays out of the shared pkg).
 */
export declare function HelpSurface({ slug, basePath, chatSlot, rootClearHref, }: {
    slug: string;
    basePath?: string;
    chatSlot?: ReactNode;
    /** Where clearing the ROOT level's selection navigates — the HMDV's own home. Defaults to the
     *  surface apex; a host whose apex is NOT the surface (the help site's `/` is a landing page,
     *  its HMDV root lives at `/home`) passes that route so unselecting everything stays on the
     *  surface instead of bouncing to the landing. */
    rootClearHref?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=HelpSurface.d.ts.map