/** Every frontend feature-flag key, in one place. A key MISSING from the delivered set means
 *  DISABLED — flags are opt-in, so a backend that is down or a flag nobody has created yet both
 *  read as "off" rather than accidentally exposing an ungated feature.
 *
 *  These are the `key` column of `system.feature_flags`; the admin console writes them and
 *  GET /system/feature-flags (public, unauthenticated) delivers the enabled ones. */
export declare const FLAG: {
    readonly newUserSignups: "new_user_signups";
    readonly newUserInvitations: "new_user_invitations";
    readonly emailAuth: "email_auth";
    readonly githubOauth: "github_oauth";
    readonly googleOauth: "google_oauth";
    readonly appleOauth: "apple_oauth";
    readonly gitlabOauth: "gitlab_oauth";
    readonly bitbucketOauth: "bitbucket_oauth";
    /** Shows the "Sign in with a passkey" option on the hub login card
     *  (LoginPage → LoginCard `onPasskeyLogin`). Off ⇒ the passkey button is hidden. */
    readonly enablePasskeySignin: "enable_passkey_signin";
    /** Shows the interactive concept-graph explorer on the logged-out landings
     *  (MarketingLanding → LandingHeroGate). Off ⇒ every site renders the static
     *  hero; the diagram is parked pending further design. */
    readonly landingSiteExplorerDiagram: "landing_site_explorer_diagram";
    /** Picks which hierarchical view every topic/detail stack on the platform renders: on ⇒ the
     *  cascading Hierarchical Menu Details View (HMDV), off ⇒ the classic Hierarchical Topic Detail
     *  (HTDV). One switch for every stack — the hub's workspace home and shell, the debug console,
     *  the builds/status boards, and the toolkit's own explorers (see HierarchicalDetailView).
     *  Off is the shipped view; the menu cascade is the experiment. */
    readonly useHierarchicalMenuDetailsView: "use_hierarchical_menu_details_view";
};
export type FlagKey = (typeof FLAG)[keyof typeof FLAG];
//# sourceMappingURL=keys.d.ts.map