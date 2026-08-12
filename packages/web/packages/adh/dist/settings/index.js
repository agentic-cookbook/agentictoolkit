"use client";
'use client'

// src/settings/settings-overlay.tsx
import {
  Component,
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

// src/layout/chunk-recovery.ts
var CHUNK_UPDATE_COPY = {
  title: "Updating to the latest version",
  description: "A newer version of the site is available. Reloading now\u2026",
  retryLabel: "Reload now"
};
var RELOAD_GUARD_KEY = "adh:chunk-reload-at";
var RELOAD_COOLDOWN_MS = 1e4;
function isChunkLoadError(error) {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error;
  if (name === "ChunkLoadError") return true;
  return typeof message === "string" && /Loading (CSS )?chunk|Failed to load chunk/i.test(message);
}
function recoverFromChunkError(error) {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;
  try {
    const now = Date.now();
    const last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY));
    if (now - last < RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// src/settings/settings-overlay.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var UserSettingsOverlay = lazy(
  () => import("@agentic-toolkit/adh/settings/UserSettingsOverlay").then((m) => ({
    default: m.UserSettingsOverlay
  }))
);
var SettingsOverlayContext = createContext(
  null
);
function useSettingsOverlay() {
  return useContext(SettingsOverlayContext);
}
function SettingsOverlayProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const value = useMemo(
    () => ({
      openSettings: () => {
        setEverOpened(true);
        setOpen(true);
      }
    }),
    []
  );
  const close = useCallback(() => setOpen(false), []);
  return /* @__PURE__ */ jsxs(SettingsOverlayContext.Provider, { value, children: [
    children,
    everOpened && // The boundary is REQUIRED, not belt-and-braces. Turning a static import into a
    // `lazy()` fetch introduced a way for this subtree to throw that hub's original
    // (which imported the overlay statically) did not have: React re-throws a rejected
    // lazy import during render, and the nearest boundary above this point is the
    // ROUTE's — AppShell mounts this provider around AdhAppShell, and AdhAppShell's
    // <AppErrorBoundary> sits inside <main> around {children} only. So without this,
    // one 404'd chunk (a tab left open across a deploy is the ordinary case) replaced
    // the whole page, header and all, on every one of the 44 header-bearing sites —
    // losing the route the user was on, which is the very thing the overlay's
    // unsaved-changes gate exists to protect.
    /* @__PURE__ */ jsx(SettingsOverlayBoundary, { visible: open, onDismiss: close, children: /* @__PURE__ */ jsx(Suspense, { fallback: open ? /* @__PURE__ */ jsx(SettingsOverlayFallback, { onCancel: close }) : null, children: /* @__PURE__ */ jsx(UserSettingsOverlay, { open, onOpenChange: setOpen }) }) })
  ] });
}
function SettingsOverlayScrim({
  label,
  onDismiss,
  children
}) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": label,
      onKeyDown: (event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll("button")
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first || !last) return;
        const edge = event.shiftKey ? first : last;
        if (document.activeElement !== edge) return;
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      },
      children: /* @__PURE__ */ jsx("div", { className: "flex max-w-sm flex-col items-center gap-3 rounded-xl border border-apt-border bg-apt-surface px-6 py-4 text-center", children })
    }
  );
}
var SCRIM_BUTTON = "rounded-md border border-apt-border px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-apt-text hover:bg-apt-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apt-gold";
function SettingsOverlayFallback({ onCancel }) {
  return /* @__PURE__ */ jsxs(SettingsOverlayScrim, { label: "Loading User Settings", onDismiss: onCancel, children: [
    /* @__PURE__ */ jsx(
      "span",
      {
        className: "font-mono text-sm tracking-wide text-apt-gold",
        role: "status",
        "aria-live": "polite",
        children: "Loading User Settings\u2026"
      }
    ),
    /* @__PURE__ */ jsx("button", { type: "button", autoFocus: true, className: SCRIM_BUTTON, onClick: onCancel, children: "Cancel" })
  ] });
}
function SettingsOverlayError({
  error,
  onDismiss
}) {
  const stale = isChunkLoadError(error);
  return /* @__PURE__ */ jsxs(
    SettingsOverlayScrim,
    {
      label: stale ? CHUNK_UPDATE_COPY.title : "User Settings could not be loaded",
      onDismiss,
      children: [
        /* @__PURE__ */ jsx("span", { className: "font-mono text-sm tracking-wide text-apt-gold", children: stale ? CHUNK_UPDATE_COPY.title : "User Settings could not be loaded" }),
        /* @__PURE__ */ jsx("span", { className: "text-sm text-apt-text-muted", children: stale ? CHUNK_UPDATE_COPY.description : "Reloading the page should fix it. Nothing else on this page is affected." }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              autoFocus: true,
              className: SCRIM_BUTTON,
              onClick: () => window.location.reload(),
              children: stale ? CHUNK_UPDATE_COPY.retryLabel : "Reload"
            }
          ),
          /* @__PURE__ */ jsx("button", { type: "button", className: SCRIM_BUTTON, onClick: onDismiss, children: "Close" })
        ] })
      ]
    }
  );
}
var SettingsOverlayBoundary = class extends Component {
  state = { failed: false, error: null };
  static getDerivedStateFromError(error) {
    return { failed: true, error };
  }
  componentDidCatch(error) {
    recoverFromChunkError(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    if (!this.props.visible) return null;
    return /* @__PURE__ */ jsx(
      SettingsOverlayError,
      {
        error: this.state.error,
        onDismiss: () => {
          this.setState({ failed: false, error: null });
          this.props.onDismiss();
        }
      }
    );
  }
};
export {
  SettingsOverlayProvider,
  useSettingsOverlay
};
//# sourceMappingURL=index.js.map