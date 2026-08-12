"use client";

import {
  Component,
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  CHUNK_UPDATE_COPY,
  isChunkLoadError,
  recoverFromChunkError,
} from "../layout/chunk-recovery";

// NOTHING may be statically imported here beyond React and the ONE exception below: this
// module is the always-loaded barrel (settings/index.ts re-exports it, every site's shell
// imports that), so a static import costs every page of ~45 sites the whole graph the
// specifier reaches. That is why SettingsOverlayFallback below is hand-rolled instead of
// reusing <Dialog>, and it is why the react-query provider the panels need lives in
// UserSettingsOverlay.tsx — inside the lazy chunk — rather than here. See
// settings/index.ts's CORRECTNESS RULE comments.
//
// The exception is `../layout/chunk-recovery`, and it is compatible with the reason above
// rather than a hole in it: that module imports NOTHING (no React, no ui, no toolkit
// package — it is a duck-typed predicate plus a sessionStorage-guarded reload), so the
// graph the specifier reaches is the file itself, ~1.5 kB. Its cooldown lives in
// sessionStorage, not module scope, so the copy inlined here cannot race the copy in
// dist/layout with a double reload. The alternative was re-deriving isChunkLoadError
// locally, and that predicate has a deliberate negative case (it must NOT match the
// generic "dynamically imported module" failures, which also fire when the user is merely
// offline) that a second hand-written copy would quietly lose.

// Lazy: the panels are ~3,000 LOC that no site should carry in its initial bundle merely
// for owning a menu row. Nothing loads until the dialog is first opened.
//
// Package path, NOT the relative `./UserSettingsOverlay` a literal read of this file's
// original (hub-local) form would suggest: adh's tsup builds with `bundle: true,
// splitting: false`, so a relative `import('./UserSettingsOverlay')` from a module in the
// SAME entry is inlined behind a lazy-init wrapper rather than code-split — there would be
// no separate chunk for `lazy()` to fetch on open, and the ~3,000 LOC of panels would ride
// in settings/index.js, the always-loaded barrel every site's SettingsOverlayProvider
// imports. UserSettingsOverlay.tsx has its own tsup entry and `external` pairing for
// exactly this reason (mirroring help/HelpProvider's identical
// `@agentic-toolkit/adh/help/HelpWindow` lazy import) — see tsup.config.ts.
const UserSettingsOverlay = lazy(() =>
  import("@agentic-toolkit/adh/settings/UserSettingsOverlay").then((m) => ({
    default: m.UserSettingsOverlay,
  })),
);

type SettingsOverlayContextValue = { openSettings: () => void };

const SettingsOverlayContext = createContext<SettingsOverlayContextValue | null>(
  null,
);

/**
 * Open the user-settings overlay from anywhere under the provider. Returns null
 * when there is no provider, so a caller can tell "no settings here" from "settings
 * that do nothing" — the header uses that to decide whether the menu gets the row
 * at all, rather than rendering a row that silently no-ops.
 */
export function useSettingsOverlay(): SettingsOverlayContextValue | null {
  return useContext(SettingsOverlayContext);
}

/**
 * Hosts the single user-settings overlay above every site's routes and exposes
 * `openSettings` to its descendants. Mounted around the app shell so the overlay
 * layers over whatever route is showing.
 */
export function SettingsOverlayProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Latched: false until the first open, true forever after. Mounting nothing before the
  // first open is what keeps the lazy chunk unfetched, and it is why every site can carry
  // this provider — including one whose header can never open it. `status` is that case, and
  // NOT for the reason this comment used to give: it does mount an adh AuthProvider
  // (status/app/providers.tsx), but it renders <SiteHeader siteId="status"/> with no
  // `useAuthSource`, so the header takes the default `useAnonymousHeaderAuth`
  // (SiteHeader.tsx) and reports no user. Carrying the provider there costs nothing:
  // nothing below renders, and no panel chunk is even requested, until the first open.
  //
  // STAYING mounted after that is deliberate, and it is not the same thing as mounting
  // eagerly. `{open && …}` — what this used to be — remounted the whole subtree per open,
  // which threw away the QueryClient UserSettingsOverlay builds (`staleTime: 5 * 60 * 1000`
  // could never apply across visits: close, reopen a second later, every topic refetches
  // cold) and denied <Dialog> any closed state to render, so it got no exit transition and
  // never restored focus to the menu item that opened it. The panels themselves still
  // unmount on close — base-ui's Portal/Popup does not keepMounted — so a close still drops
  // every panel's draft edits and every useReportSettingsDirty entry with it.
  const [everOpened, setEverOpened] = useState(false);
  const value = useMemo<SettingsOverlayContextValue>(
    () => ({
      openSettings: () => {
        setEverOpened(true);
        setOpen(true);
      },
    }),
    [],
  );
  const close = useCallback(() => setOpen(false), []);
  return (
    <SettingsOverlayContext.Provider value={value}>
      {children}
      {everOpened && (
        // The boundary is REQUIRED, not belt-and-braces. Turning a static import into a
        // `lazy()` fetch introduced a way for this subtree to throw that hub's original
        // (which imported the overlay statically) did not have: React re-throws a rejected
        // lazy import during render, and the nearest boundary above this point is the
        // ROUTE's — AppShell mounts this provider around AdhAppShell, and AdhAppShell's
        // <AppErrorBoundary> sits inside <main> around {children} only. So without this,
        // one 404'd chunk (a tab left open across a deploy is the ordinary case) replaced
        // the whole page, header and all, on every one of the 44 header-bearing sites —
        // losing the route the user was on, which is the very thing the overlay's
        // unsaved-changes gate exists to protect.
        <SettingsOverlayBoundary visible={open} onDismiss={close}>
          {/* `open ? … : null`, not an unconditional fallback: the subtree stays mounted
              after the first open (see everOpened above), so while the chunk is still in
              flight the fallback would keep painting over the page even after the user
              cancelled it. */}
          <Suspense fallback={open ? <SettingsOverlayFallback onCancel={close} /> : null}>
            <UserSettingsOverlay open={open} onOpenChange={setOpen} />
          </Suspense>
        </SettingsOverlayBoundary>
      )}
    </SettingsOverlayContext.Provider>
  );
}

/**
 * The scrim both pre-dialog states share: a full-screen cover with a card in it, an
 * explicit way out, and enough dialog semantics to match what it is standing in for.
 *
 * Hand-rolled from a handful of utilities rather than reusing the shared <Dialog>: this
 * module IS the always-loaded barrel, so importing the dialog primitive here would drag it
 * and its base-ui dependency into the eager graph of every site — the exact cost the
 * `lazy()` above exists to avoid. The backdrop matches DialogContent's so the real dialog
 * lands in place rather than replacing a differently-shaded screen.
 *
 * What it deliberately does NOT skip, having taken on the dialog's shape: the dialog's
 * EXITS. `DialogContent` renders a close button (`showClose = true`) and base-ui closes on
 * Escape; a `fixed inset-0` cover with neither is not a lighter dialog, it is a screen the
 * user cannot get out of — and the loading case can sit there for as long as a slow link
 * takes to deliver the panel chunk. So: Escape at the window (nothing here is focused when
 * the cover appears), a visible dismiss button that takes focus on mount, and Tab wrapped
 * inside the card so the keyboard cannot walk into the content the cover is hiding.
 */
function SettingsOverlayScrim({
  label,
  onDismiss,
  children,
}: {
  label: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    // At the window, not on the element: when this mounts, focus is wherever the menu item
    // that opened the overlay left it, so an element-level handler would never see the key.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        // Focus starts inside (the dismiss button autofocuses) and Escape/dismiss is the
        // only way out, so wrapping between the card's own controls is a real trap rather
        // than a decoration: two buttons at most, so first/last is the whole cycle.
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first || !last) return;
        const edge = event.shiftKey ? first : last;
        if (document.activeElement !== edge) return;
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }}
    >
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-apt-border bg-apt-surface px-6 py-4 text-center">
        {children}
      </div>
    </div>
  );
}

const SCRIM_BUTTON =
  "rounded-md border border-apt-border px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-apt-text hover:bg-apt-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apt-gold";

/**
 * What the user sees between clicking "User Settings" and the panel chunk arriving.
 *
 * NOT `fallback={null}`: the menu closes on click, so an empty fallback is a dead click —
 * on a slow connection nothing at all appears and the user clicks again. That was invisible
 * while a static re-export in settings/index.ts kept the chunk in the eager bundle (it
 * resolved in the same tick); removing that re-export is what makes this boundary real.
 */
function SettingsOverlayFallback({ onCancel }: { onCancel: () => void }) {
  return (
    <SettingsOverlayScrim label="Loading User Settings" onDismiss={onCancel}>
      <span
        className="font-mono text-sm tracking-wide text-apt-gold"
        role="status"
        aria-live="polite"
      >
        Loading User Settings…
      </span>
      <button type="button" autoFocus className={SCRIM_BUTTON} onClick={onCancel}>
        Cancel
      </button>
    </SettingsOverlayScrim>
  );
}

/**
 * What the user sees when the panel chunk never arrives.
 *
 * Reload rather than Retry, deliberately: React caches a `lazy()` rejection, so re-rendering
 * the same lazy component throws the same error forever — a "Try again" button here would
 * be a lie. A stale deploy (the common case) has already been sent for a guarded reload by
 * the boundary below; this is what shows in the frame before it lands, and the resting
 * state when the cooldown declines it.
 */
function SettingsOverlayError({
  error,
  onDismiss,
}: {
  error: unknown;
  onDismiss: () => void;
}) {
  const stale = isChunkLoadError(error);
  return (
    <SettingsOverlayScrim
      label={stale ? CHUNK_UPDATE_COPY.title : "User Settings could not be loaded"}
      onDismiss={onDismiss}
    >
      <span className="font-mono text-sm tracking-wide text-apt-gold">
        {stale ? CHUNK_UPDATE_COPY.title : "User Settings could not be loaded"}
      </span>
      <span className="text-sm text-apt-text-muted">
        {stale
          ? CHUNK_UPDATE_COPY.description
          : "Reloading the page should fix it. Nothing else on this page is affected."}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          autoFocus
          className={SCRIM_BUTTON}
          onClick={() => window.location.reload()}
        >
          {stale ? CHUNK_UPDATE_COPY.retryLabel : "Reload"}
        </button>
        <button type="button" className={SCRIM_BUTTON} onClick={onDismiss}>
          Close
        </button>
      </div>
    </SettingsOverlayScrim>
  );
}

/**
 * Keeps a failed overlay chunk fetch inside the overlay.
 *
 * A class because React has no hook form of an error boundary, and local rather than
 * `@agentic-toolkit/adh/layout`'s AppErrorBoundary because that one reaches @sentry/react
 * and ErrorFallback's ui graph — the eager cost this module refuses (and because
 * layout/AppShell imports this file, so importing layout back would close a cycle between
 * two tsup entries).
 *
 * `visible` is what keeps a failure the user has already walked away from off the screen:
 * the subtree stays mounted after the first open, so a rejection thrown while the overlay
 * is closed must render nothing — and must still render the card the next time it is
 * opened, because the reason it will not open is exactly what the user needs told.
 */
class SettingsOverlayBoundary extends Component<
  { visible: boolean; onDismiss: () => void; children: ReactNode },
  { failed: boolean; error: unknown }
> {
  state: { failed: boolean; error: unknown } = { failed: false, error: null };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error };
  }

  componentDidCatch(error: unknown) {
    // The same stale-deploy recovery every other adh surface gets (AppErrorBoundary runs it
    // from an effect): at most one hard reload, cooldown in sessionStorage, no-op for any
    // other error.
    recoverFromChunkError(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (!this.props.visible) return null;
    return (
      <SettingsOverlayError
        error={this.state.error}
        onDismiss={() => {
          this.setState({ failed: false, error: null });
          this.props.onDismiss();
        }}
      />
    );
  }
}
