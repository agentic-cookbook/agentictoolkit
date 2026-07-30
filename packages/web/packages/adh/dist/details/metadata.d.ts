import type { Metadata } from 'next';
import { type SiteId } from '@agentic-toolkit/adh-registry';
/** Next `Metadata` for a site's details page — a specific `topic`, or the site's
 *  details overview when omitted. Canonical points at the site's own host so each
 *  topic is an independently-indexable URL. Lives here (not in the framework-free
 *  concepts module) because it depends on `next`. */
export declare function detailsMetadata(siteId: SiteId, topic?: string): Metadata;
//# sourceMappingURL=metadata.d.ts.map