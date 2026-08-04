'use client'

"use client";

// src/header/header-auth.ts
import { useAuth, beginLogin, isAdmin, ssoSwitchUrl } from "@agentic-toolkit/auth";
import { siteHomePath } from "@agentic-toolkit/adh-registry";
function toAvatarUser(u, fallback = "User") {
  const fullName = u.name?.trim() || void 0;
  return {
    name: fullName || u.label?.trim() || u.email?.split("@")[0] || fallback,
    fullName,
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
function defaultReturnTo(siteId) {
  if (typeof window === "undefined" || !siteId) return currentPath();
  return window.location.pathname === "/" ? siteHomePath(siteId) : currentPath();
}
function makeSmartHeaderAuth(cfg = {}) {
  const { clientId = "adh", returnTo, avatarFallback = "User" } = cfg;
  return function useSmartHeaderAuth(opts) {
    const { user, logout, isLoading } = useAuth();
    const login = () => beginLogin({ clientId, returnTo: returnTo?.() ?? defaultReturnTo(opts.siteId) });
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
  defaultReturnTo,
  makeSmartHeaderAuth,
  ssoSwitchResolver,
  toAvatarUser,
  useAnonymousHeaderAuth
};
//# sourceMappingURL=header-auth.js.map