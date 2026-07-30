/**
 * The current client hostname (`host:port`), or `null` until after mount.
 *
 * Returns `null` on the server AND on the first client render, then the real
 * host once mounted — so any value derived from it (env-aware hrefs, dev-only
 * affordances) can't cause a hydration mismatch: server and first-client render
 * agree on `null`, and the host arrives in a post-mount re-render.
 *
 * Single source for the `window.location.host` read that the header pieces
 * (AdhHeader's hub-href resolution, SiteSwitcher's cross-site href + env) all
 * need, so the read/effect isn't re-implemented per component.
 */
export declare function useClientHost(): string | null;
//# sourceMappingURL=useClientHost.d.ts.map