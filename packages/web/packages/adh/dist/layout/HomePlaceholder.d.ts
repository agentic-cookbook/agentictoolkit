export type HomePlaceholderProps = {
    /** The site's display label, e.g. "Products". Injected rather than looked up: the 48-entry
     *  site registry is adh VOCABULARY living in `@agentic-toolkit/adh-registry`. This package
     *  does declare that sibling now — the prop is a DESIGN choice, not a boundary the build
     *  enforces: it keeps this placeholder renderable by a host with no site registry at all.
     *  `@agentic-toolkit/adh/layout`'s AppShell wraps it and resolves `getSite(siteId)?.label`,
     *  so adh call sites keep passing `siteId` and see no change. */
    siteLabel: string;
    /** Optional override for the body copy. */
    blurb?: string;
};
/**
 * A themed placeholder for a site's authenticated /home, used where real home
 * content doesn't exist yet. Renders against the shared theme tokens so it
 * matches the rest of the site.
 */
export declare function HomePlaceholder({ siteLabel, blurb }: HomePlaceholderProps): import("react").JSX.Element;
//# sourceMappingURL=HomePlaceholder.d.ts.map