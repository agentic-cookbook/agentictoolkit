import { type FooterLink } from '@agentic-toolkit/adh/footer';
export type SiteFooterProps = {
    links?: FooterLink[];
};
/** adh's footer: the toolkit's identity-free primitive ({@link ToolkitFooter}, published as
 *  `AdhFooter` from this same barrel) plus everything that IS adh — the FishLamp brand
 *  line, the sites popover, the legal modals, and bitbag himself. The copyright is a fixed
 *  brand line, deliberately not per-site.
 *
 *  Named `SiteFooter` rather than `AdhFooter`: this barrel already publishes an `AdhFooter`
 *  — the registry-free primitive this component wraps. The two are unrelated components
 *  that happened to share a name; this one is adh's REGISTRY-AWARE composition. */
export declare function SiteFooter({ links }: SiteFooterProps): import("react").JSX.Element;
//# sourceMappingURL=SiteFooter.d.ts.map