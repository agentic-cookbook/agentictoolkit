'use client'

"use client";

// src/header/hub-preferences.ts
import { useSyncExternalStore } from "react";
var DEFAULT_SITE_MENU_SHORTCUT = "mod+shift+k";
var KEY = "adh:hub-preferences";
var DEFAULTS = { siteMenuShortcut: DEFAULT_SITE_MENU_SHORTCUT };
var snapshot = DEFAULTS;
function readStorage() {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
    const stored = parsed.siteMenuShortcut;
    return typeof stored === "string" ? { siteMenuShortcut: stored } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}
function writeStorage(prefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
  }
}
var listeners = /* @__PURE__ */ new Set();
function emit() {
  for (const l of listeners) l();
}
if (typeof window !== "undefined") snapshot = readStorage();
function readHubPreferences() {
  return snapshot;
}
function setSiteMenuShortcut(keys) {
  if (snapshot.siteMenuShortcut === keys) return;
  snapshot = { ...snapshot, siteMenuShortcut: keys };
  writeStorage(snapshot);
  emit();
}
function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (e) => {
    if (e.key !== null && e.key !== KEY) return;
    snapshot = readStorage();
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
function useHubPreferences() {
  return useSyncExternalStore(subscribe, readHubPreferences, () => DEFAULTS);
}
export {
  DEFAULT_SITE_MENU_SHORTCUT,
  readHubPreferences,
  setSiteMenuShortcut,
  useHubPreferences
};
//# sourceMappingURL=hub-preferences.js.map