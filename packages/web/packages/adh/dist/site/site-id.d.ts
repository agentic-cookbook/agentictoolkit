import { type ReactNode } from 'react';
import type { SiteId } from '@agentic-toolkit/adh-registry';
/**
 * Carries the site's own id from the SERVER layout, which reads `site.config`, down to the
 * client components under it that cannot.
 *
 * A context and not a prop because of who the consumers are: `SiteHomeShell` is mounted by
 * `page.tsx` from `@/home-model`, which is the site's CLIENT module and deliberately knows
 * nothing about `site.config` — the split that keeps `research`'s server-only sitemap reads out
 * of browser bundles (SiteConfig.ts:125-137). Threading the id through the model instead would
 * mean adding a line to 40 per-site `home-model.tsx` files that the scaffolder does not cover,
 * restating an id the config already holds.
 *
 * Deliberately NOT a fallback-bearing hook: a component that needs the site id and is mounted
 * outside the provider is misplaced, and returning a guess would hide that.
 */
export declare function SiteIdProvider({ siteId, children }: {
    siteId: SiteId;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useSiteId(): SiteId;
//# sourceMappingURL=site-id.d.ts.map