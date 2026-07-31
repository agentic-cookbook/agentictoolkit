'use client'

"use client";

// src/debug-env/SiteThemeConsole.tsx
import { useEffect, useState as useState3 } from "react";
import { HierarchicalDetailView } from "@agentic-toolkit/ui/blocks";
import { useThemeEditor } from "@agentic-toolkit/adh/themes";

// src/debug-env/SiteThemeBranch.tsx
import { useRef, useState as useState2 } from "react";
import { Braces, Brush, Globe, Layers, Megaphone, Paintbrush, SwatchBook, Type } from "lucide-react";
import { Button } from "@agentic-toolkit/ui/components/button";
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

// src/debug-env/selection-store.ts
import { useCallback, useState } from "react";
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
  const [value, setValue] = useState(
    () => resolveStoredSelection(readRaw(key), isValid, fallback)
  );
  const set = useCallback(
    (next) => {
      setValue(next);
      writeRaw(key, next ?? CLEARED);
    },
    [key]
  );
  return [value, set];
}

// src/debug-env/SiteThemeBranch.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var AREA_ICONS = {
  global: /* @__PURE__ */ jsx(Globe, {}),
  type: /* @__PURE__ */ jsx(Type, {}),
  marketing: /* @__PURE__ */ jsx(Megaphone, {}),
  custom: /* @__PURE__ */ jsx(Braces, {})
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
  const [pending, setPending] = useState2(null);
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
    icon: t.source === "seed" ? /* @__PURE__ */ jsx(SwatchBook, {}) : /* @__PURE__ */ jsx(Paintbrush, {}),
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
      items: THEME_AREAS.map((a) => ({ id: a.id, label: a.label, icon: AREA_ICONS[a.id] ?? /* @__PURE__ */ jsx(Layers, {}) })),
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
      items: area.items.map((i) => ({ id: i.id, label: i.label, icon: /* @__PURE__ */ jsx(Brush, {}) })),
      selectedId: itemId,
      onSelect: (id) => setItemId(id),
      onClear: () => setItemId(null)
    });
  }
  const leaf = ed.selectedKey != null ? /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    area && item ? /* @__PURE__ */ jsx(ItemCssDetail, { ed, area, item, themeAreas }) : /* @__PURE__ */ jsx(ThemeMetaDetail, { ed }),
    /* @__PURE__ */ jsx(ThemeActionFooter, { ed })
  ] }) : /* @__PURE__ */ jsx("div", { className: "flex flex-1 items-center justify-center p-6 text-center text-sm text-apt-text-muted", children: "Pick a theme to edit, or start a new one with \uFF0B above." });
  const prompt = /* @__PURE__ */ jsx(
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
  return /* @__PURE__ */ jsxs("div", { className: "shrink-0 border-t border-apt-border", children: [
    ed.error && /* @__PURE__ */ jsx("p", { className: "px-4 pt-1.5 font-mono text-xs text-apt-red", children: ed.error }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-2 px-4 py-2", children: [
      /* @__PURE__ */ jsx(
        Button,
        {
          size: "sm",
          variant: "destructive-ghost",
          onClick: () => void ed.remove(),
          disabled: !ed.canDelete,
          children: "Delete"
        }
      ),
      /* @__PURE__ */ jsx(Button, { size: "sm", variant: "ghost", onClick: ed.cancel, disabled: !(ed.dirty || ed.isNew), children: "Cancel" }),
      /* @__PURE__ */ jsx(Button, { size: "sm", onClick: () => void ed.save(), disabled: !ed.canSave || ed.saving, children: ed.saving ? "Saving\u2026" : "Save" })
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
  return /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4", children: [
    /* @__PURE__ */ jsxs("label", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsx("span", { className: "text-sm text-apt-text-muted", children: "Theme label" }),
      /* @__PURE__ */ jsx(Input, { value: ed.label, disabled: ed.isSeed, onChange: (e) => ed.setLabel(e.target.value) })
    ] }),
    ed.isNew && /* @__PURE__ */ jsxs("label", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsx("span", { className: "text-sm text-apt-text-muted", children: "Key" }),
      /* @__PURE__ */ jsx(Input, { value: ed.themeKey, onChange: (e) => ed.setThemeKey(e.target.value) })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "text-sm text-apt-text-dim", children: "Pick an area, then an item, to edit its CSS." })
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
  const exampleRef = useRef(null);
  const [prefill, setPrefill] = useState2("");
  const saved = ed.itemCss(item.id);
  const value = saved || prefill;
  const clip = useClipboard();
  useIsomorphicLayoutEffect(() => {
    if (saved) return;
    const id = requestAnimationFrame(() => setPrefill(readItemCss(item.id, exampleRef.current)));
    return () => cancelAnimationFrame(id);
  }, [item, saved, readItemCss]);
  return /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4", children: [
    /* @__PURE__ */ jsx("div", { ref: exampleRef, className: "rounded-md border border-apt-border", children: /* @__PURE__ */ jsx(Preview, {}) }),
    /* @__PURE__ */ jsx("div", { className: "flex items-center justify-end", children: /* @__PURE__ */ jsx(Button, { size: "sm", variant: "ghost", onClick: () => void clip.copy(ed.exportCss()), children: clip.copied ? "Copied" : "Copy all CSS" }) }),
    /* @__PURE__ */ jsx(CssEditor, { value, onChange: (v) => ed.setItemCss(item.id, v) })
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
  return /* @__PURE__ */ jsx(Dialog, { open, onOpenChange: (next) => !next && !saving && onCancel(), children: /* @__PURE__ */ jsxs(DialogContent, { showClose: !saving, children: [
    /* @__PURE__ */ jsxs(DialogHeader, { children: [
      /* @__PURE__ */ jsx(DialogTitle, { children: "Unsaved theme changes" }),
      /* @__PURE__ */ jsx(DialogDescription, { children: "Save them, discard them, or stay to keep editing." })
    ] }),
    error && /* @__PURE__ */ jsx("p", { className: "font-mono text-xs text-apt-red", children: error }),
    /* @__PURE__ */ jsxs(DialogFooter, { className: "flex-row justify-end gap-2", children: [
      /* @__PURE__ */ jsx(Button, { size: "sm", variant: "ghost", onClick: onCancel, disabled: saving, children: "Cancel" }),
      /* @__PURE__ */ jsx(Button, { size: "sm", variant: "destructive-ghost", onClick: onDiscard, disabled: saving, children: "Discard" }),
      /* @__PURE__ */ jsx(Button, { size: "sm", onClick: onSave, disabled: saving, children: saving ? "Saving\u2026" : "Save" })
    ] })
  ] }) });
}

// src/debug-env/SiteThemeConsole.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function SiteThemeConsole({
  rootLevel,
  leaveRef,
  themeAreas
}) {
  const [surface, setSurface] = useState3(null);
  useEffect(() => {
    let live = true;
    void themeAreas().then((s) => {
      if (live) setSurface(s);
    });
    return () => {
      live = false;
    };
  }, [themeAreas]);
  if (!surface) return null;
  return /* @__PURE__ */ jsx2(SiteThemeBody, { rootLevel, leaveRef, themeAreas: surface });
}
function SiteThemeBody({
  rootLevel,
  leaveRef,
  themeAreas
}) {
  const ed = useThemeEditor();
  const site = useSiteThemeBranch(ed, themeAreas);
  useEffect(() => {
    leaveRef.current = ed.dirty ? site.guardLeave : null;
    return () => {
      leaveRef.current = null;
    };
  }, [ed.dirty, site, leaveRef]);
  return /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx2(
      HierarchicalDetailView,
      {
        levels: [rootLevel, ...site.levels],
        rootLabel: "Debug Options",
        disclosureStyle: "cascading",
        exitGuard: null,
        children: site.leaf
      }
    ),
    site.prompt
  ] });
}
export {
  SiteThemeConsole
};
//# sourceMappingURL=SiteThemeConsole.js.map