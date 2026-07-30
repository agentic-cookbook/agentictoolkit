import type { ReactNode } from 'react';
export type LandingHeroGateProps = {
    /** The interactive concept-graph explorer (server-rendered, passed through). */
    diagram: ReactNode;
    /** The static hero shown while the diagram flag is off (the default). */
    fallback: ReactNode;
};
/**
 * Gates the landing's concept-graph explorer behind the
 * `landing_site_explorer_diagram` feature flag. A gate, so only an explicit Yes
 * shows the diagram: backend down, flag absent, and first paint (still Fetching)
 * all fall to the static hero, and it never flashes in unbidden.
 * Both subtrees arrive server-rendered as props; this client chokepoint only
 * picks which one mounts (same pattern as AdhFooter's bitbag gate).
 */
export declare function LandingHeroGate({ diagram, fallback }: LandingHeroGateProps): ReactNode;
//# sourceMappingURL=LandingHeroGate.d.ts.map