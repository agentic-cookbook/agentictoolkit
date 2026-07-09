"use client";

import { useEffect, useRef } from "react";

/**
 * The Narratives feature pane: an iframe of the published static narratives bundle
 * (the narratives CLI builds it into public/narratives-app), auth-gated by the
 * enclosing layout. Shared by the workspace launcher / Projects feature and the
 * standalone /<slug>/narratives route so the embed stays in one place.
 *
 * Deep-linking (opt-in): the inner app is a same-origin HashRouter bundle, so a
 * `path` (from the standalone route's catch-all) is carried into the iframe hash on
 * COLD LOAD — a shared / Recents link opens that inner view directly. When the inner
 * app then navigates, `onNavigate` mirrors its hash back into the outer URL (the
 * route uses history.replaceState, NOT a router push — so it never reloads the iframe
 * and can't loop). Embedded uses (launcher / Projects) pass neither prop, so the
 * frame is the plain static iframe it has always been.
 */
export function NarrativesFrame({
  path,
  onNavigate,
}: {
  /** Inner narrative path (the route's catch-all segments), reflected into the iframe hash. */
  path?: string;
  /** Called with the inner path when the iframe's own hash navigation changes. */
  onNavigate?: (innerPath: string) => void;
} = {}) {
  const ref = useRef<HTMLIFrameElement>(null);
  // Cold-load src carries the deep hash so a restored/shared link opens that view.
  const initialSrc = `/narratives-app/index.html${path ? `#/${path}` : ""}`;

  // Keep the latest onNavigate in a ref so the mirror effect can run ONCE (empty deps)
  // and never be torn down by onNavigate's per-render identity change — otherwise a
  // re-render after the iframe's one-shot `load` would remove the live `hashchange`
  // listener and re-add only a `load` listener that never fires again (SPA hash nav =
  // no reload), silently killing the mirror.
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let win: Window | null = null;
    const sync = () => {
      try {
        const hash = win?.location.hash ?? iframe.contentWindow?.location.hash ?? "";
        onNavigateRef.current?.(hash.replace(/^#\/?/, ""));
      } catch {
        /* cross-origin (shouldn't happen for the local bundle) — skip */
      }
    };
    const attach = () => {
      try {
        win = iframe.contentWindow;
        win?.addEventListener("hashchange", sync);
        sync(); // reflect the just-loaded hash immediately
      } catch {
        /* cross-origin */
      }
    };
    iframe.addEventListener("load", attach);
    // If the iframe already finished loading before this effect ran (fast static
    // bundle), `load` won't fire again — attach the hashchange listener now too.
    try {
      if (iframe.contentWindow?.document.readyState === "complete") attach();
    } catch {
      /* cross-origin / not ready — the load listener will cover it */
    }
    return () => {
      iframe.removeEventListener("load", attach);
      try {
        win?.removeEventListener("hashchange", sync);
      } catch {
        /* ignore */
      }
    };
    // Mount-once: onNavigate is read via ref; the iframe ref is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <iframe
      ref={ref}
      src={initialSrc}
      title="Narratives"
      className="min-h-0 w-full flex-1 border-0"
    />
  );
}
