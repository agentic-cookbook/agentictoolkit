'use client'

"use client";

// src/header/header-auth.ts
import { useAuth, beginLogin, isAdmin, ssoSwitchUrl } from "@agentic-toolkit/auth";
function toAvatarUser(u, fallback = "User") {
  return {
    name: u.name || u.email?.split("@")[0] || fallback,
    email: u.email,
    imageUrl: u.avatarUrl || void 0
  };
}
function ssoSwitchResolver(signedIn) {
  return signedIn ? (href) => ssoSwitchUrl(href) : void 0;
}
function useAnonymousHeaderAuth(_opts) {
  return { user: null, authLoading: false };
}
function currentPath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}
function makeSmartHeaderAuth(cfg = {}) {
  const { clientId = "adh", returnTo, avatarFallback = "User" } = cfg;
  return function useSmartHeaderAuth(_opts) {
    const { user, logout, isLoading } = useAuth();
    const login = () => beginLogin({ clientId, returnTo: returnTo?.() ?? currentPath() });
    return {
      user: user ? toAvatarUser(user, avatarFallback) : null,
      // Unlocks the site menu's dev tail (Routes, site families, Debug Options)
      // in every env for a signed-in adh admin — see AdhHeaderAuthProps.
      userIsAdmin: isAdmin(user),
      // Spinner while the session resolves, not a flash of the signed-out buttons.
      authLoading: isLoading,
      resolveSwitchHref: ssoSwitchResolver(user != null),
      onLogin: login,
      onSignup: login,
      // context.logout already runs ssoLogout({ clientId }) + clearSsoChecked.
      onLogout: () => {
        void logout();
      }
    };
  };
}
export {
  makeSmartHeaderAuth,
  ssoSwitchResolver,
  toAvatarUser,
  useAnonymousHeaderAuth
};
//# sourceMappingURL=header-auth.js.map