import { type FooterLink } from '@agentic-toolkit/adh/footer';
export type SiteFooterProps = {
    links?: FooterLink[];
    /** Mount bitbag. Default true — he belongs on every real footer. `false` is for
     *  the ONE case that isn't one: a footer rendered as a specimen inside the theme
     *  editor's preview pane. He portals himself to `document.body` (see
     *  FooterChatInner), so a preview cannot contain him with a scoped `display:none`
     *  the way it hides the in-flow theme switcher — he escapes the pane and lands
     *  full-size over the console that is previewing him. Not mounting him is the
     *  only thing that actually works, and it says what it means.
     *
     *  On THIS component, not the {@link ToolkitFooter} primitive it wraps: the
     *  primitive takes a generic `trailing` slot and has no idea bitbag exists, which
     *  is the whole point of the split. */
    chat?: boolean;
};
/** The footer's build identity: `v1.0.155 · a73e79b7`, or null when neither field exists.
 *
 *  Two fields doing two jobs. The semver is hand-bumped and scoped to ONE site's
 *  directory, so it answers "did my change ship?"; the SHA is stamped on every
 *  build from any cause — including a submodule bump that touched no file under
 *  the site — so it answers "which build is this?". Each covers the other's blind
 *  spot: a version alone only moves when someone remembers, and a bare SHA means
 *  nothing unless you happen to be holding the commit you deployed.
 *
 *  Both are read as literal `process.env.NEXT_PUBLIC_*` expressions so Next's
 *  build-time substitution reaches them (the same mechanism TelemetryProvider
 *  already round-trips for NEXT_PUBLIC_ADH_RELEASE). Exported for the contract test.
 *
 *  The title carries the FULL sha rather than a build timestamp: a timestamp would
 *  make every build's bundle differ from identical source, and this repo has already
 *  paid for non-reproducible artifacts once. */
export declare function buildVersionLabel(): import("react").JSX.Element | null;
/** adh's footer: the toolkit's identity-free primitive ({@link ToolkitFooter}, published as
 *  `AdhFooter` from this same barrel) plus everything that IS adh — the FishLamp brand
 *  line, the sites popover, the legal modals, and bitbag himself. The copyright is a fixed
 *  brand line, deliberately not per-site.
 *
 *  Named `SiteFooter` rather than `AdhFooter`: this barrel already publishes an `AdhFooter`
 *  — the registry-free primitive this component wraps. The two are unrelated components
 *  that happened to share a name; this one is adh's REGISTRY-AWARE composition. */
export declare function SiteFooter({ links, chat }: SiteFooterProps): import("react").JSX.Element;
//# sourceMappingURL=SiteFooter.d.ts.map