/**
 * Shown when `/<slug>` or `/<slug>/profile` resolves to neither a feature nor a principal the
 * viewer may see. A principal is a user OR an organization — they share one slug namespace —
 * and the backend returns 404 both for a slug that does not exist and for one whose owner has
 * not admitted this viewer, so this page never reveals which it was.
 *
 * Includes a search box that calls `GET /api/public/users/search?q=<query>` — one endpoint over
 * both namespaces, which is why each hit carries its `kind`.
 *
 * Lives in @agentic-toolkit/adh rather than in the hub: every site in the fleet renders a
 * profile now, so every site can miss one.
 */
export declare function ProfileNotFound(): import("react").JSX.Element;
//# sourceMappingURL=ProfileNotFound.d.ts.map