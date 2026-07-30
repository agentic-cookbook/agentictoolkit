'use client'

// src/debug-env/DebugConsole.tsx
import { useEffect as useEffect4, useRef as useRef3 } from "react";
import { MessagesSquare, Palette, SlidersHorizontal, SquareTerminal } from "lucide-react";
import { HierarchicalDetailView } from "@agentic-toolkit/ui/blocks";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { useThemeEditor } from "@agentic-toolkit/adh/themes";

// src/debug-env/FloatingWindow.tsx
import {
  useCallback,
  useEffect as useEffect2,
  useId,
  useLayoutEffect,
  useRef,
  useState as useState2
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@agentic-toolkit/ui/components/button";

// src/hooks/useIsMounted.ts
import { useEffect, useState } from "react";
function useIsMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

// src/debug-env/FloatingWindow.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function FloatingWindow({
  open,
  onClose,
  title,
  children
}) {
  const ref = useRef(null);
  const mounted = useIsMounted();
  const titleId = useId();
  const [pos, setPos] = useState2(null);
  const initialSize = useRef(null);
  const dragTeardown = useRef(null);
  useEffect2(() => {
    if (!open) return;
    const w = Math.min(1400, Math.round(window.innerWidth * 0.95));
    const h = Math.min(920, Math.round(window.innerHeight * 0.88));
    initialSize.current = { w, h };
    setPos({
      x: Math.round((window.innerWidth - w) / 2),
      y: Math.round((window.innerHeight - h) / 2)
    });
  }, [open]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !initialSize.current) return;
    el.style.width = `${initialSize.current.w}px`;
    el.style.height = `${initialSize.current.h}px`;
    initialSize.current = null;
  });
  useEffect2(() => {
    if (!open) return;
    const nestedOverlayOpen = () => !!document.querySelector('[data-open][role="dialog"]');
    let escapeBelongedToNested = false;
    const onKeyCapture = (e) => {
      if (e.key === "Escape") escapeBelongedToNested = nestedOverlayOpen();
    };
    const onKeyBubble = (e) => {
      if (e.key === "Escape" && !escapeBelongedToNested) onClose();
    };
    window.addEventListener("keydown", onKeyCapture, true);
    window.addEventListener("keydown", onKeyBubble);
    return () => {
      window.removeEventListener("keydown", onKeyCapture, true);
      window.removeEventListener("keydown", onKeyBubble);
    };
  }, [open, onClose]);
  useEffect2(() => () => dragTeardown.current?.(), []);
  const onHeaderPointerDown = useCallback(
    (e) => {
      if (!pos || e.button !== 0) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { ...pos };
      const move = (ev) => {
        const w = ref.current?.offsetWidth ?? 0;
        setPos({
          x: Math.max(120 - w, Math.min(origin.x + (ev.clientX - startX), window.innerWidth - 120)),
          y: Math.max(0, Math.min(origin.y + (ev.clientY - startY), window.innerHeight - 44))
        });
      };
      const teardown = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", teardown);
        dragTeardown.current = null;
      };
      dragTeardown.current = teardown;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", teardown);
    },
    [pos]
  );
  if (!open || !mounted || !pos) return null;
  return createPortal(
    /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        role: "dialog",
        "aria-labelledby": titleId,
        className: "fixed z-50 flex flex-col overflow-hidden rounded-xl border border-apt-border bg-apt-surface text-apt-text shadow-2xl",
        style: {
          left: pos.x,
          top: pos.y,
          resize: "both",
          minWidth: 520,
          minHeight: 360,
          maxWidth: "100vw",
          maxHeight: "100vh"
        },
        children: [
          /* @__PURE__ */ jsxs(
            "div",
            {
              onPointerDown: onHeaderPointerDown,
              className: "flex shrink-0 cursor-move select-none items-center justify-between border-b border-apt-border bg-apt-bg px-5 py-3",
              children: [
                /* @__PURE__ */ jsx("span", { id: titleId, className: "font-mono text-sm text-apt-gold", children: title }),
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    variant: "ghost",
                    size: "icon-xs",
                    "aria-label": "Close",
                    onClick: onClose,
                    className: "text-apt-text-muted hover:text-apt-text",
                    children: /* @__PURE__ */ jsx(X, { className: "size-4" })
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "flex min-h-0 flex-1 flex-col", children })
        ]
      }
    ),
    document.body
  );
}

// src/debug-env/DebugConsoleProvider.tsx
import { createContext, useContext } from "react";
import { jsx as jsx2 } from "react/jsx-runtime";
var DebugConsoleContext = createContext({});
function DebugConsoleProvider({
  config,
  children
}) {
  return /* @__PURE__ */ jsx2(DebugConsoleContext.Provider, { value: config, children });
}
function useDebugConsoleConfig() {
  return useContext(DebugConsoleContext);
}

// src/debug-env/EnvironmentPanel.tsx
import { useEffect as useEffect3, useState as useState3 } from "react";

// src/debug-env/env-vars.ts
var SECRET_PATTERN = /KEY|SECRET|TOKEN|PASSWORD|PASSWD|DSN|PRIVATE|CREDENTIAL/i;
function isSecretName(name) {
  return SECRET_PATTERN.test(name);
}
function maskValue(value) {
  if (value.length <= 4) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  return `${value.slice(0, 4)}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022`;
}
function collectEnvVars(names, read) {
  const out = [];
  for (const name of names) {
    const raw = read(name);
    if (raw == null || raw === "") continue;
    const secret = isSecretName(name);
    out.push({ name, value: secret ? maskValue(raw) : raw, secret });
  }
  return out;
}
var SITE_ENV_VARS = [
  // Deployment / backend wiring
  "DEPLOYMENT_ENV",
  "NEXT_PUBLIC_DEPLOYMENT_ENV",
  "API_BACKEND_URL",
  "NEXT_PUBLIC_AUTH_API_URL",
  "NODE_ENV",
  // Feature gates
  "DEBUG_MENU",
  "AI_CHAT",
  // Read in the BROWSER by the shared FeatureFlagsProvider, so it must be NEXT_PUBLIC_ to be
  // inlined at build time (the flag set is no longer composed in a per-site server route).
  "NEXT_PUBLIC_DEV_FEATURE_FLAGS",
  // Telemetry
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_GLITCHTIP_DSN",
  "NEXT_PUBLIC_TELEMETRY_DEBUG"
];
function debugEnvEntries() {
  return collectEnvVars(SITE_ENV_VARS, (name) => process.env[name]);
}

// src/debug-env/EnvVarList.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function EnvVarList({ entries }) {
  if (entries.length === 0) {
    return /* @__PURE__ */ jsx3("p", { className: "text-sm text-apt-text-muted", children: "No tracked env vars are set." });
  }
  return /* @__PURE__ */ jsx3("dl", { className: "flex flex-col gap-1.5", children: entries.map((entry) => /* @__PURE__ */ jsxs2(
    "div",
    {
      className: "flex items-baseline justify-between gap-4 text-xs",
      children: [
        /* @__PURE__ */ jsx3("dt", { className: "shrink-0 font-mono text-apt-text-muted", children: entry.name }),
        /* @__PURE__ */ jsxs2("dd", { className: "min-w-0 text-right font-mono break-all text-apt-text", children: [
          entry.value,
          entry.secret && /* @__PURE__ */ jsx3("span", { className: "ml-1 text-apt-text-dim", children: "(masked)" })
        ] })
      ]
    },
    entry.name
  )) });
}

// src/debug-env/EnvironmentPanel.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var CLIENT_ENV = {
  NEXT_PUBLIC_DEPLOYMENT_ENV: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,
  NEXT_PUBLIC_AUTH_API_URL: process.env.NEXT_PUBLIC_AUTH_API_URL,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_GLITCHTIP_DSN: process.env.NEXT_PUBLIC_GLITCHTIP_DSN,
  NEXT_PUBLIC_TELEMETRY_DEBUG: process.env.NEXT_PUBLIC_TELEMETRY_DEBUG
};
function fetchEntries(url) {
  return fetch(url).then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status)))).then((d) => d.entries);
}
function EnvironmentPanel() {
  const [site, setSite] = useState3(null);
  const [backend, setBackend] = useState3(null);
  useEffect3(() => {
    fetchEntries("/api/public/debug-env").then(setSite).catch(() => setSite("unavailable"));
    fetchEntries("/api/system/debug-env").then(setBackend).catch(() => setBackend("unavailable"));
  }, []);
  const client = collectEnvVars(Object.keys(CLIENT_ENV), (name) => CLIENT_ENV[name]);
  const siteEntries = Array.isArray(site) && site.length > 0 ? site : client;
  return /* @__PURE__ */ jsxs3("div", { className: "flex flex-col gap-4 overflow-auto p-4", children: [
    /* @__PURE__ */ jsxs3("section", { children: [
      /* @__PURE__ */ jsx4("h3", { className: "mb-2 font-mono text-xs tracking-[0.02em] text-apt-text-muted", children: "Site (frontend)" }),
      /* @__PURE__ */ jsx4(EnvVarList, { entries: siteEntries })
    ] }),
    /* @__PURE__ */ jsxs3("section", { children: [
      /* @__PURE__ */ jsx4("h3", { className: "mb-2 font-mono text-xs tracking-[0.02em] text-apt-text-muted", children: "Backend" }),
      backend === null ? /* @__PURE__ */ jsx4("p", { className: "font-mono text-xs text-apt-text-dim", children: "Loading\u2026" }) : backend === "unavailable" ? /* @__PURE__ */ jsx4("p", { className: "font-mono text-xs text-apt-text-dim", children: "Backend env unavailable." }) : /* @__PURE__ */ jsx4(EnvVarList, { entries: backend })
    ] })
  ] });
}

// src/debug-env/SettingsPanel.tsx
import { Switch } from "@agentic-toolkit/ui/components/switch";
import {
  useShowDebugFrames,
  setShowDebugFrames,
  useSlowAnimations,
  setSlowAnimations,
  useCascadeLog,
  setCascadeLog
} from "@agentic-toolkit/ui/blocks";
import { Fragment, jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function DebugSwitch({
  id,
  label,
  hint,
  checked,
  onChange
}) {
  return /* @__PURE__ */ jsxs4("label", { htmlFor: id, className: "flex items-center justify-between gap-4 px-4 py-3", children: [
    /* @__PURE__ */ jsxs4("span", { className: "flex flex-col", children: [
      /* @__PURE__ */ jsx5("span", { className: "text-sm text-apt-text", children: label }),
      /* @__PURE__ */ jsx5("span", { className: "font-mono text-xs text-apt-text-dim", children: hint })
    ] }),
    /* @__PURE__ */ jsx5(Switch, { id, checked, onCheckedChange: (c) => onChange(c === true) })
  ] });
}
function SettingsPanel({ envOverride }) {
  const { useEnvOverride, setEnvOverride } = envOverride;
  const override = useEnvOverride();
  const showFrames = useShowDebugFrames();
  const slowAnimations = useSlowAnimations();
  const cascadeLog = useCascadeLog();
  return /* @__PURE__ */ jsxs4("div", { className: "flex flex-col divide-y divide-apt-border overflow-auto", children: [
    /* @__PURE__ */ jsx5(
      DebugSwitch,
      {
        id: "adh-env-sim-prod",
        label: "Simulate production",
        hint: "DEPLOYMENT_ENV = production",
        checked: override === "production",
        onChange: (on) => setEnvOverride(on ? "production" : null)
      }
    ),
    /* @__PURE__ */ jsx5(
      DebugSwitch,
      {
        id: "adh-debug-mouse-frames",
        label: "Show Mouse Detection Frames",
        hint: "red = auto-collapse \xB7 green = auto-disclose",
        checked: showFrames,
        onChange: setShowDebugFrames
      }
    ),
    /* @__PURE__ */ jsx5(
      DebugSwitch,
      {
        id: "adh-debug-slow-anim",
        label: "Slow down animations by 10x",
        hint: "0.3s \u2192 3s, so transitions can be watched",
        checked: slowAnimations,
        onChange: setSlowAnimations
      }
    ),
    /* @__PURE__ */ jsx5(
      DebugSwitch,
      {
        id: "adh-debug-cascade-log",
        label: "Log cascade interactions",
        hint: /* @__PURE__ */ jsxs4(Fragment, { children: [
          "one console line per event \u2014 ",
          /* @__PURE__ */ jsx5("code", { children: "copy(__hmdvLogDump())" }),
          " grabs the whole trace"
        ] }),
        checked: cascadeLog,
        onChange: setCascadeLog
      }
    )
  ] });
}

// src/debug-env/ChatThemePanel.tsx
import { Paintbrush, SwatchBook } from "lucide-react";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var DEFAULT_ID = "__default";
function toId(key) {
  return key ?? DEFAULT_ID;
}
function fromId(id) {
  return id === DEFAULT_ID ? null : id;
}
function buildChatThemeLevel(chat) {
  const items = [
    { id: DEFAULT_ID, label: "App default", icon: /* @__PURE__ */ jsx6(SwatchBook, {}) },
    ...chat.themes.map((t) => ({ id: t.key, label: t.label, icon: /* @__PURE__ */ jsx6(Paintbrush, {}) }))
  ];
  return {
    id: "chat",
    title: "Chat theme",
    items,
    selectedId: toId(chat.current),
    // Package-owned unselection: HTD calls onClear on a re-click; treat that as
    // "revert to app default" so the leaf always previews the active theme.
    onSelect: (id) => chat.onChange(fromId(id)),
    onClear: () => chat.onChange(null),
    emptyLabel: "No chat themes."
  };
}
function ChatThemePreview({ chat }) {
  return /* @__PURE__ */ jsxs5("div", { className: "flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4", children: [
    /* @__PURE__ */ jsx6("p", { className: "font-mono text-xs text-apt-text-dim", children: chat.current ? `Previewing: ${chat.current}` : "App default" }),
    /* @__PURE__ */ jsx6("div", { className: "rounded-md border border-apt-border p-3", children: chat.renderPreview(chat.current) })
  ] });
}

// src/debug-env/selection-store.ts
import { useCallback as useCallback2, useState as useState4 } from "react";
var PREFIX = "adh:debug-console:";
var CLEARED = "";
function readRaw(key) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}
function writeRaw(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
  }
}
function resolveStoredSelection(raw, isValid, fallback) {
  if (raw === null) return fallback;
  if (raw === CLEARED) return null;
  return isValid(raw) ? raw : fallback;
}
function usePersistedSelection(key, isValid, fallback) {
  const [value, setValue] = useState4(
    () => resolveStoredSelection(readRaw(key), isValid, fallback)
  );
  const set = useCallback2(
    (next) => {
      setValue(next);
      writeRaw(key, next ?? CLEARED);
    },
    [key]
  );
  return [value, set];
}

// src/debug-env/SiteThemeBranch.tsx
import { useRef as useRef2, useState as useState5 } from "react";
import { Braces, Brush, Globe, Layers, Megaphone, Paintbrush as Paintbrush2, SwatchBook as SwatchBook2, Type } from "lucide-react";
import { Button as Button2 } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from "@agentic-toolkit/ui/components/dialog";
import { useClipboard } from "@agentic-toolkit/ui/hooks/useClipboard";
import { useIsomorphicLayoutEffect } from "@agentic-toolkit/ui/hooks/useIsomorphicLayoutEffect";
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var AREA_ICONS = {
  global: /* @__PURE__ */ jsx7(Globe, {}),
  type: /* @__PURE__ */ jsx7(Type, {}),
  marketing: /* @__PURE__ */ jsx7(Megaphone, {}),
  custom: /* @__PURE__ */ jsx7(Braces, {})
};
function useSiteThemeBranch(ed, themeAreas) {
  const { areas: THEME_AREAS } = themeAreas;
  const [areaId, setAreaId] = usePersistedSelection(
    "site-theme.area",
    (id) => THEME_AREAS.some((a) => a.id === id),
    null
  );
  const [itemId, setItemId] = usePersistedSelection(
    "site-theme.item",
    (id) => (THEME_AREAS.find((a) => a.id === areaId)?.items ?? []).some((i) => i.id === id),
    null
  );
  const [pending, setPending] = useState5(null);
  const area = THEME_AREAS.find((a) => a.id === areaId) ?? null;
  const item = area?.items.find((i) => i.id === itemId) ?? null;
  const guardLeave = (run) => {
    if (ed.dirty) setPending({ type: "action", run });
    else run();
  };
  const requestFocus = (key) => {
    if (ed.dirty && key !== ed.selectedKey) setPending({ type: "focus", key });
    else {
      ed.select(key);
      setAreaId(null);
      setItemId(null);
    }
  };
  const themeItems = ed.themes.map((t) => ({
    id: t.key,
    label: t.label,
    // Row icons carry the built-in/custom distinction now: a built-in (seed) theme is the shipped
    // swatch book, a custom theme is a brush of its own (no placeholder circles).
    icon: t.source === "seed" ? /* @__PURE__ */ jsx7(SwatchBook2, {}) : /* @__PURE__ */ jsx7(Paintbrush2, {}),
    // Custom (db) themes keep their key as a dim second line to tell them apart; seed themes
    // are single-line now — the old "built-in" subtitle padded every row for no real signal.
    sublabel: t.source === "seed" ? void 0 : t.key
  }));
  const levels = [
    {
      id: "themes",
      title: "Themes",
      items: themeItems,
      selectedId: ed.selectedKey,
      onSelect: (key) => requestFocus(key),
      onClear: () => requestFocus(null),
      emptyLabel: "No themes.",
      // "New theme" is the Themes list header's ＋ (guarded so a dirty draft prompts first),
      // gold-tinted while a fresh unsaved theme is in progress (nothing selected in the list).
      onNew: () => guardLeave(() => ed.newTheme()),
      newLabel: "New theme",
      newActive: ed.isNew
    }
  ];
  if (ed.selectedKey != null) {
    levels.push({
      id: "areas",
      title: "Areas",
      items: THEME_AREAS.map((a) => ({ id: a.id, label: a.label, icon: AREA_ICONS[a.id] ?? /* @__PURE__ */ jsx7(Layers, {}) })),
      selectedId: areaId,
      onSelect: (id) => {
        setAreaId(id);
        const next = THEME_AREAS.find((a) => a.id === id);
        setItemId(next?.items[0]?.id ?? null);
      },
      onClear: () => {
        setAreaId(null);
        setItemId(null);
      }
    });
  }
  if (area) {
    levels.push({
      id: "items",
      title: area.label,
      items: area.items.map((i) => ({ id: i.id, label: i.label, icon: /* @__PURE__ */ jsx7(Brush, {}) })),
      selectedId: itemId,
      onSelect: (id) => setItemId(id),
      onClear: () => setItemId(null)
    });
  }
  const leaf = ed.selectedKey != null ? /* @__PURE__ */ jsxs6("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    area && item ? /* @__PURE__ */ jsx7(ItemCssDetail, { ed, area, item, themeAreas }) : /* @__PURE__ */ jsx7(ThemeMetaDetail, { ed }),
    /* @__PURE__ */ jsx7(ThemeActionFooter, { ed })
  ] }) : /* @__PURE__ */ jsx7("div", { className: "flex flex-1 items-center justify-center p-6 text-center text-sm text-apt-text-muted", children: "Pick a theme to edit, or start a new one with \uFF0B above." });
  const prompt = /* @__PURE__ */ jsx7(
    UnsavedPrompt,
    {
      open: pending !== null,
      saving: ed.saving,
      error: ed.error,
      onSave: async () => {
        if (await ed.save()) {
          applyPending(pending, ed, setAreaId, setItemId);
          setPending(null);
        }
      },
      onDiscard: () => {
        ed.cancel();
        applyPending(pending, ed, setAreaId, setItemId);
        setPending(null);
      },
      onCancel: () => setPending(null)
    }
  );
  return { levels, leaf, requestFocus, guardLeave, prompt };
}
function ThemeActionFooter({ ed }) {
  return /* @__PURE__ */ jsxs6("div", { className: "shrink-0 border-t border-apt-border", children: [
    ed.error && /* @__PURE__ */ jsx7("p", { className: "px-4 pt-1.5 font-mono text-xs text-apt-red", children: ed.error }),
    /* @__PURE__ */ jsxs6("div", { className: "flex items-center justify-end gap-2 px-4 py-2", children: [
      /* @__PURE__ */ jsx7(
        Button2,
        {
          size: "sm",
          variant: "destructive-ghost",
          onClick: () => void ed.remove(),
          disabled: !ed.canDelete,
          children: "Delete"
        }
      ),
      /* @__PURE__ */ jsx7(Button2, { size: "sm", variant: "ghost", onClick: ed.cancel, disabled: !(ed.dirty || ed.isNew), children: "Cancel" }),
      /* @__PURE__ */ jsx7(Button2, { size: "sm", onClick: () => void ed.save(), disabled: !ed.canSave || ed.saving, children: ed.saving ? "Saving\u2026" : "Save" })
    ] })
  ] });
}
function applyPending(pending, ed, setAreaId, setItemId) {
  if (!pending) return;
  if (pending.type === "focus") {
    ed.select(pending.key);
    setAreaId(null);
    setItemId(null);
  } else {
    pending.run();
  }
}
function ThemeMetaDetail({ ed }) {
  return /* @__PURE__ */ jsxs6("div", { className: "flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4", children: [
    /* @__PURE__ */ jsxs6("label", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsx7("span", { className: "text-sm text-apt-text-muted", children: "Theme label" }),
      /* @__PURE__ */ jsx7(Input, { value: ed.label, disabled: ed.isSeed, onChange: (e) => ed.setLabel(e.target.value) })
    ] }),
    ed.isNew && /* @__PURE__ */ jsxs6("label", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsx7("span", { className: "text-sm text-apt-text-muted", children: "Key" }),
      /* @__PURE__ */ jsx7(Input, { value: ed.themeKey, onChange: (e) => ed.setThemeKey(e.target.value) })
    ] }),
    /* @__PURE__ */ jsx7("p", { className: "text-sm text-apt-text-dim", children: "Pick an area, then an item, to edit its CSS." })
  ] });
}
function ItemCssDetail({
  ed,
  area,
  item,
  themeAreas
}) {
  const { readItemCss, CssEditor } = themeAreas;
  const Preview = item.Preview ?? area.Preview;
  const exampleRef = useRef2(null);
  const [prefill, setPrefill] = useState5("");
  const saved = ed.itemCss(item.id);
  const value = saved || prefill;
  const clip = useClipboard();
  useIsomorphicLayoutEffect(() => {
    if (saved) return;
    const id = requestAnimationFrame(() => setPrefill(readItemCss(item.id, exampleRef.current)));
    return () => cancelAnimationFrame(id);
  }, [item, saved, readItemCss]);
  return /* @__PURE__ */ jsxs6("div", { className: "flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4", children: [
    /* @__PURE__ */ jsx7("div", { ref: exampleRef, className: "rounded-md border border-apt-border", children: /* @__PURE__ */ jsx7(Preview, {}) }),
    /* @__PURE__ */ jsx7("div", { className: "flex items-center justify-end", children: /* @__PURE__ */ jsx7(Button2, { size: "sm", variant: "ghost", onClick: () => void clip.copy(ed.exportCss()), children: clip.copied ? "Copied" : "Copy all CSS" }) }),
    /* @__PURE__ */ jsx7(CssEditor, { value, onChange: (v) => ed.setItemCss(item.id, v) })
  ] });
}
function UnsavedPrompt({
  open,
  saving,
  error,
  onSave,
  onDiscard,
  onCancel
}) {
  return /* @__PURE__ */ jsx7(Dialog, { open, onOpenChange: (next) => !next && !saving && onCancel(), children: /* @__PURE__ */ jsxs6(DialogContent, { showClose: !saving, children: [
    /* @__PURE__ */ jsxs6(DialogHeader, { children: [
      /* @__PURE__ */ jsx7(DialogTitle, { children: "Unsaved theme changes" }),
      /* @__PURE__ */ jsx7(DialogDescription, { children: "Save them, discard them, or stay to keep editing." })
    ] }),
    error && /* @__PURE__ */ jsx7("p", { className: "font-mono text-xs text-apt-red", children: error }),
    /* @__PURE__ */ jsxs6(DialogFooter, { className: "flex-row justify-end gap-2", children: [
      /* @__PURE__ */ jsx7(Button2, { size: "sm", variant: "ghost", onClick: onCancel, disabled: saving, children: "Cancel" }),
      /* @__PURE__ */ jsx7(Button2, { size: "sm", variant: "destructive-ghost", onClick: onDiscard, disabled: saving, children: "Discard" }),
      /* @__PURE__ */ jsx7(Button2, { size: "sm", onClick: onSave, disabled: saving, children: saving ? "Saving\u2026" : "Save" })
    ] })
  ] }) });
}

// src/debug-env/DebugConsole.tsx
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var TOP_ITEMS = [
  { id: "settings", label: "Settings", icon: /* @__PURE__ */ jsx8(SlidersHorizontal, {}) },
  { id: "environment", label: "Environment", icon: /* @__PURE__ */ jsx8(SquareTerminal, {}) },
  { id: "site-theme", label: "Site theme", icon: /* @__PURE__ */ jsx8(Palette, {}) },
  { id: "chat-theme", label: "Chat theme", icon: /* @__PURE__ */ jsx8(MessagesSquare, {}) }
];
function DebugConsoleWindow({
  open,
  onClose,
  envOverride,
  themeAreas
}) {
  const closeRef = useRef3(onClose);
  closeRef.current = onClose;
  return /* @__PURE__ */ jsx8(FloatingWindow, { open, onClose: () => closeRef.current(), title: "Debug Options", children: /* @__PURE__ */ jsx8(
    DebugConsoleBody,
    {
      onClose,
      closeRef,
      envOverride,
      themeAreas
    }
  ) });
}
function DebugConsoleBody({
  onClose,
  closeRef,
  envOverride,
  themeAreas
}) {
  const config = useDebugConsoleConfig();
  const rootItems = TOP_ITEMS.filter((t) => t.id !== "chat-theme" || config.chatTheme != null);
  const [top, setTop] = usePersistedSelection(
    "top",
    (id) => rootItems.some((t) => t.id === id),
    "environment"
  );
  const ed = useThemeEditor();
  const site = useSiteThemeBranch(ed, themeAreas);
  const setTopGuarded = (next) => {
    if (top === "site-theme" && ed.dirty) site.guardLeave(() => setTop(next));
    else setTop(next);
  };
  useEffect4(() => {
    closeRef.current = () => top === "site-theme" && ed.dirty ? site.guardLeave(() => onClose()) : onClose();
  }, [top, ed.dirty, site, onClose, closeRef]);
  const rootLevel = {
    id: "root",
    // A titled header — like every other level — so this first list reserves the same header
    // height and its rows align with Themes/Areas, reading as the HTD's first column rather than
    // a bare flat list floating above the others. (Matches the breadcrumb's "Debug Options" root.)
    title: "Debug Options",
    items: rootItems.map((t) => ({ id: t.id, label: t.label, icon: t.icon })),
    selectedId: top,
    onSelect: (id) => setTopGuarded(id),
    // Deselect the topic — the same clear the breadcrumb root, a re-click, and (in narrow mode)
    // Back all route through. Guarded, so a dirty Site-theme draft still prompts first.
    onClear: () => setTopGuarded(null)
  };
  let levels = [rootLevel];
  let leaf = /* @__PURE__ */ jsx8(
    EmptyState,
    {
      className: "m-4",
      title: "No topic selected",
      description: "Choose a debug topic to inspect."
    }
  );
  if (top === "environment") {
    leaf = /* @__PURE__ */ jsx8(EnvironmentPanel, {});
  } else if (top === "settings") {
    leaf = /* @__PURE__ */ jsx8(SettingsPanel, { envOverride });
  } else if (top === "site-theme") {
    levels = [rootLevel, ...site.levels];
    leaf = site.leaf;
  } else if (top === "chat-theme" && config.chatTheme) {
    levels = [rootLevel, buildChatThemeLevel(config.chatTheme)];
    leaf = /* @__PURE__ */ jsx8(ChatThemePreview, { chat: config.chatTheme });
  }
  return /* @__PURE__ */ jsxs7("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col", children: [
    /* @__PURE__ */ jsx8(
      HierarchicalDetailView,
      {
        levels,
        rootLabel: "Debug Options",
        disclosureStyle: "cascading",
        exitGuard: null,
        children: leaf
      }
    ),
    site.prompt
  ] });
}
export {
  DebugConsoleProvider,
  DebugConsoleWindow,
  EnvVarList,
  FloatingWindow,
  SITE_ENV_VARS,
  collectEnvVars,
  debugEnvEntries,
  isSecretName,
  maskValue,
  useDebugConsoleConfig
};
//# sourceMappingURL=index.js.map