'use client'

"use client";

// src/header/recents.ts
import { useSyncExternalStore } from "react";
var KEY = "adh:recents";
var RECENTS_CAP = 10;
var snapshot = [];
function readStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) => typeof r === "object" && r !== null && typeof r.url === "string" && typeof r.label === "string" && typeof r.ts === "number"
    );
  } catch {
    return [];
  }
}
function writeStorage(list) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
  }
}
var listeners = /* @__PURE__ */ new Set();
function emit() {
  for (const l of listeners) l();
}
if (typeof window !== "undefined") snapshot = readStorage();
function readRecents() {
  return snapshot;
}
function recordRecent(place) {
  const next = [
    { ...place, ts: Date.now() },
    ...snapshot.filter((r) => r.url !== place.url)
  ].slice(0, RECENTS_CAP);
  snapshot = next;
  writeStorage(next);
  emit();
}
function clearRecents() {
  snapshot = [];
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
var EMPTY = [];
function useRecents() {
  return useSyncExternalStore(subscribe, readRecents, () => EMPTY);
}
export {
  RECENTS_CAP,
  clearRecents,
  readRecents,
  recordRecent,
  useRecents
};
//# sourceMappingURL=recents.js.map