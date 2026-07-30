'use client'

"use client";

// src/footer/FooterChatInner.tsx
import { BitbagDock } from "@agentic-toolkit/bitbag";

// src/footer/chat-theme-store.ts
import { useCallback, useSyncExternalStore } from "react";
import { themeIds } from "@agentic-toolkit/bitbag";
var STORAGE_KEY = "adh-chat-theme";
function readStored() {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && themeIds.includes(v)) return v;
  } catch {
  }
  return null;
}
function writeStored(next) {
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, next);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  window.dispatchEvent(new CustomEvent(STORAGE_KEY));
}
function subscribe(callback) {
  if (typeof window === "undefined") return () => {
  };
  window.addEventListener(STORAGE_KEY, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_KEY, callback);
    window.removeEventListener("storage", callback);
  };
}
function useChatTheme() {
  const theme = useSyncExternalStore(subscribe, readStored, () => null);
  const setTheme = useCallback((next) => writeStored(next), []);
  return [theme, setTheme];
}

// src/footer/FooterChatInner.tsx
import "@agentic-toolkit/bitbag/css/bitbag-dock.css";
import { jsx } from "react/jsx-runtime";
function FooterChatInner() {
  const [chatTheme] = useChatTheme();
  return /* @__PURE__ */ jsx(BitbagDock, { className: "adh-footer__chat", theme: chatTheme ?? void 0 });
}
export {
  FooterChatInner as default
};
//# sourceMappingURL=FooterChatInner.js.map