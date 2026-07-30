'use client'

// src/flags/FeatureFlagsProvider.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { jsx } from "react/jsx-runtime";
var FlagState = {
  Yes: "yes",
  No: "no",
  Fetching: "fetching"
};
function flagEnabled(state) {
  return state === FlagState.Yes;
}
var FeatureFlagsContext = createContext({
  // The default context is what a tree with no provider sees, and no provider means no fetch is
  // coming — so this is a settled No, not a Fetching that would never resolve.
  flagState: () => FlagState.No
});
function parseList(raw) {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
function devCookieFlags() {
  if (false) return [];
  if (typeof document === "undefined") return [];
  const m = document.cookie.match(/(?:^|; )dev_flags=([^;]*)/);
  return m?.[1] ? parseList(decodeURIComponent(m[1])) : [];
}
var buildFlags = new Set(parseList(process.env.NEXT_PUBLIC_DEV_FEATURE_FLAGS));
function clientFlags() {
  return [...buildFlags, ...devCookieFlags()];
}
function FeatureFlagsProvider({
  children,
  backendFlags = true
}) {
  const [flags, setFlags] = useState(buildFlags);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let live = true;
    if (!backendFlags) {
      setFlags(new Set(clientFlags()));
      setSettled(true);
      return;
    }
    fetch("/api/system/feature-flags", { cache: "no-store" }).then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status)))).then(
      (rows) => Array.isArray(rows) ? rows.filter((f) => f.enabled === true).map((f) => f.key) : []
    ).catch(() => []).then((backendKeys) => {
      if (!live) return;
      setFlags(/* @__PURE__ */ new Set([...backendKeys, ...clientFlags()]));
      setSettled(true);
    });
    return () => {
      live = false;
    };
  }, [backendFlags]);
  const flagState = useCallback(
    (key) => flags.has(key) ? FlagState.Yes : settled ? FlagState.No : FlagState.Fetching,
    [flags, settled]
  );
  const value = useMemo(() => ({ flagState }), [flagState]);
  return /* @__PURE__ */ jsx(FeatureFlagsContext.Provider, { value, children });
}
function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
function useFeatureFlag(key) {
  return useContext(FeatureFlagsContext).flagState(key);
}
function useFlagEnabled(key) {
  return flagEnabled(useFeatureFlag(key));
}

// src/flags/keys.ts
var FLAG = {
  newUserSignups: "new_user_signups",
  newUserInvitations: "new_user_invitations",
  emailAuth: "email_auth",
  githubOauth: "github_oauth",
  googleOauth: "google_oauth",
  appleOauth: "apple_oauth",
  gitlabOauth: "gitlab_oauth",
  bitbucketOauth: "bitbucket_oauth",
  /** Shows the "Sign in with a passkey" option on the hub login card
   *  (LoginPage → LoginCard `onPasskeyLogin`). Off ⇒ the passkey button is hidden. */
  enablePasskeySignin: "enable_passkey_signin",
  /** Shows the interactive concept-graph explorer on the logged-out landings
   *  (MarketingLanding → LandingHeroGate). Off ⇒ every site renders the static
   *  hero; the diagram is parked pending further design. */
  landingSiteExplorerDiagram: "landing_site_explorer_diagram",
  /** Picks which hierarchical view every topic/detail stack on the platform renders: on ⇒ the
   *  cascading Hierarchical Menu Details View (HMDV), off ⇒ the classic Hierarchical Topic Detail
   *  (HTDV). One switch for every stack — the hub's workspace home and shell, the debug console,
   *  the builds/status boards, and the toolkit's own explorers (see HierarchicalDetailView).
   *  Off is the shipped view; the menu cascade is the experiment. */
  useHierarchicalMenuDetailsView: "use_hierarchical_menu_details_view"
};
export {
  FLAG,
  FeatureFlagsProvider,
  FlagState,
  flagEnabled,
  useFeatureFlag,
  useFeatureFlags,
  useFlagEnabled
};
//# sourceMappingURL=index.js.map