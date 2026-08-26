'use client'

// src/themes/AdhThemeStyle.tsx
import dynamic from "next/dynamic";
import { preload } from "react-dom";
import { themes as themes2 } from "@agenticdevelopertoolkit/themes/manifest";
import { splitImports, parseRootProps } from "@agenticdevelopertoolkit/themes/tokens";
import { APPEARANCE_PREPAINT_SCRIPT } from "@agenticdevelopertoolkit/themes/appearance";
import { THEME_FONT_PRELOADS } from "@agenticdevelopertoolkit/themes/fonts";

// src/themes/adh-themes.ts
var ADH_THEME_COOKIE = "adh-theme";
var BASE_CUT_ALIASES = ["adh-iosevka"];
var isBaseCutAlias = (key) => BASE_CUT_ALIASES.includes(key);
var ADH_THEMES = [
  { key: "adh", label: "ADH" },
  { key: "adh-iosevka", label: "Iosevka" },
  { key: "adh-manrope", label: "Manrope" },
  { key: "adh-courier", label: "Courier" },
  { key: "adh-comic", label: "Comic" },
  { key: "adh-jetbrains", label: "JetBrains" },
  { key: "adh-fira", label: "Fira" }
].filter((t) => !isBaseCutAlias(t.key));
var DEFAULT_ADH_THEME = "adh";
var FULL_PALETTE_THEMES = [
  "signal",
  "nord",
  "solarized",
  "rose-pine",
  "gruvbox",
  "github",
  "tokyo-night",
  "catppuccin",
  "one-dark",
  "dracula",
  "monokai",
  "cobalt2",
  "synthwave84",
  "vesper",
  // Site themes carried over from agentic-web-toolkit. They were registered in the theme
  // manifest but never listed here, so for a year they were authored, shipped and
  // unpickable — the switcher only ever offered what this list names. They declared just
  // the ~13-token legacy palette, which cannot reskin the M3 chrome (the base defines the
  // legacy names as var() aliases OF the roles, so overriding an alias leaves the role
  // underneath untouched); they now declare the full role set, converted by the toolkit's
  // scripts/convert-legacy-theme.py. The last three were only ever in the OLD toolkit and
  // were missed when its themes were merged in — see that script for the whole story.
  "agenticcookbookweb",
  "dev-team",
  "mikefullerton",
  "myprojects",
  "myprojectsoverview",
  "professional",
  "techy",
  "terminal",
  "terminal-split",
  "whimsical",
  "green-matrix",
  "green-matrix-glass",
  "old-school-terminal",
  // The ADH family's own two. `charcoal` is the family default (see DEFAULT_SITE_THEME);
  // it was saved as a theme in its own right when `fishlamp` briefly held that job, which
  // is what made pointing the default back at it a one-word edit rather than a re-authoring.
  "charcoal",
  "fishlamp"
];
var DEFAULT_SITE_THEME = "charcoal";
var BASE_FACE_THEMES = [
  DEFAULT_ADH_THEME,
  ...BASE_CUT_ALIASES,
  "charcoal",
  "fishlamp"
];
var usesBaseThemeFonts = (key) => BASE_FACE_THEMES.includes(key);
var isFullPaletteTheme = (key) => FULL_PALETTE_THEMES.includes(key);

// src/themes/theme-keys.ts
import { themes } from "@agenticdevelopertoolkit/themes/manifest";
var adhThemeKeys = () => Object.keys(themes).filter(
  (k) => k.startsWith("adh") && !isBaseCutAlias(k)
);
var switcherThemeKeys = () => [
  ...adhThemeKeys(),
  ...FULL_PALETTE_THEMES
];

// src/themes/theme-preview.ts
var THEME_STORAGE_KEY = "adh-theme";
var ALT_STYLE_SELECTOR = "style[data-adh-theme-alt]";
function applyBaseTheme(seedKey) {
  if (typeof document === "undefined") return;
  document.querySelectorAll(ALT_STYLE_SELECTOR).forEach((el) => {
    el.media = el.getAttribute("data-adh-theme-alt") === seedKey ? "all" : "not all";
  });
}
function cookieDomain() {
  const h = location.hostname;
  if (h === "localhost" || h.endsWith(".localhost")) return "localhost";
  const parts = h.split(".");
  return parts.length <= 2 ? h : parts.slice(-2).join(".");
}
function readStoredTheme() {
  const m = document.cookie.match(/(?:^|; )adh-theme=([^;]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}
function persistTheme(id) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
  }
  try {
    document.cookie = `${THEME_STORAGE_KEY}=${id};domain=${cookieDomain()};path=/;max-age=31536000;samesite=lax`;
  } catch {
  }
}
function readPreviewTheme() {
  if (typeof document === "undefined") return null;
  if (!document.querySelector(ALT_STYLE_SELECTOR)) return null;
  return readStoredTheme();
}
function appendThemePreview(href, theme) {
  if (!theme || !href.startsWith("http")) return href;
  try {
    const u = new URL(href);
    if (u.hash && !u.hash.startsWith("#adh-theme=")) return href;
    u.hash = `adh-theme=${theme}`;
    return u.toString();
  } catch {
    return href;
  }
}
function themePrePaintScript() {
  const K = THEME_STORAGE_KEY;
  const D = DEFAULT_SITE_THEME;
  return `(function(){try{var K='${K}',D='${D}',OK=/^[-\\w]+$/;var hm=location.hash.match(/(?:^|[#&])${K}=([^&]+)/);var raw=hm?decodeURIComponent(hm[1]):null;var carried=(raw&&OK.test(raw)&&document.querySelector('style[data-adh-theme-alt="'+raw+'"]'))?raw:null;if(carried){try{localStorage.setItem(K,carried);}catch(e){}var hn=location.hostname,d=(hn==='localhost'||/\\.localhost$/.test(hn))?'localhost':(function(){var p=hn.split('.');return p.length<=2?hn:p.slice(-2).join('.');})();document.cookie=K+'='+carried+';domain='+d+';path=/;max-age=31536000;samesite=lax';}if(hm){history.replaceState(null,'',location.pathname+location.search);}var m=document.cookie.match(/(?:^|; )${K}=([^;]+)/);var t=carried||(m?decodeURIComponent(m[1]):localStorage.getItem(K));if(!t||!OK.test(t))t=D;var s=document.querySelector('style[data-adh-theme-alt="'+t+'"]')||document.querySelector('style[data-adh-theme-alt="'+D+'"]');if(s)s.media='all';}catch(e){}})();`;
}

// src/themes/AdhThemeStyle.tsx
import { isDevDeploymentEnv } from "@agentic-toolkit/adh-registry/deployment-env";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var switcherEnv = () => isDevDeploymentEnv(process.env.DEPLOYMENT_ENV);
var DbThemeApplier = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "local" || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "testing" || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "staging" ? dynamic(
  () => import("@agentic-toolkit/adh/themes/DbThemeApplier").then((m) => m.DbThemeApplier)
) : null;
function ThemeSwitcherAssets({ defaultImports }) {
  if (!switcherEnv()) return null;
  const already = new Set(defaultImports);
  const fonts = /* @__PURE__ */ new Set();
  const baseProps = parseRootProps(themes2[DEFAULT_ADH_THEME].css);
  const blocks = [];
  for (const key of switcherThemeKeys()) {
    const { imports, rest } = splitImports(themes2[key].css);
    imports.forEach((u) => !already.has(u) && fonts.add(u));
    const label = themes2[key].label;
    if (isFullPaletteTheme(key)) {
      blocks.push({ key, label, css: rest });
    } else {
      const delta = [...parseRootProps(rest)].filter(([k, v]) => baseProps.get(k) !== v);
      blocks.push({ key, label, css: `:root{${delta.map(([k, v]) => `${k}:${v}`).join(";")}}` });
    }
  }
  const prePaint = themePrePaintScript();
  const origins = /* @__PURE__ */ new Map();
  for (const href of fonts) {
    let origin;
    try {
      ;
      ({ origin } = new URL(href));
    } catch {
      continue;
    }
    origins.set(origin, origins.get(origin) ?? false);
    if (origin === "https://fonts.googleapis.com") origins.set("https://fonts.gstatic.com", true);
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    [...origins].map(([origin, cors]) => /* @__PURE__ */ jsx(
      "link",
      {
        rel: "preconnect",
        href: origin,
        ...cors ? { crossOrigin: "anonymous" } : {}
      },
      `pc:${origin}`
    )),
    [...fonts].map((href) => /* @__PURE__ */ jsx("link", { rel: "stylesheet", href, "data-adh-theme-switch-font": "" }, `sw:${href}`)),
    blocks.map(({ key, label, css }) => /* @__PURE__ */ jsx(
      "style",
      {
        "data-adh-theme-alt": key,
        "data-adh-theme-label": label,
        media: "not all",
        suppressHydrationWarning: true,
        dangerouslySetInnerHTML: { __html: css }
      },
      `alt:${key}`
    )),
    /* @__PURE__ */ jsx("script", { dangerouslySetInnerHTML: { __html: prePaint } }),
    DbThemeApplier ? /* @__PURE__ */ jsx(DbThemeApplier, {}) : null
  ] });
}
function SiteDefaultTheme({ baseImports }) {
  if (switcherEnv() || DEFAULT_SITE_THEME === DEFAULT_ADH_THEME) return null;
  const entry = themes2[DEFAULT_SITE_THEME];
  if (!entry) return null;
  const { imports, rest } = splitImports(entry.css);
  const already = new Set(baseImports);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    imports.filter((href) => !already.has(href)).map((href) => /* @__PURE__ */ jsx(
      "link",
      {
        rel: "stylesheet",
        href,
        "data-adh-theme-import": DEFAULT_SITE_THEME
      },
      href
    )),
    /* @__PURE__ */ jsx(
      "style",
      {
        "data-adh-site-theme": DEFAULT_SITE_THEME,
        dangerouslySetInnerHTML: { __html: rest }
      }
    )
  ] });
}
function AdhThemeStyle() {
  const entry = themes2[DEFAULT_ADH_THEME];
  if (!entry) return null;
  if (usesBaseThemeFonts(DEFAULT_SITE_THEME)) {
    for (const href of THEME_FONT_PRELOADS) {
      preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
    }
  }
  const { imports, rest } = splitImports(entry.css);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    imports.map((href) => /* @__PURE__ */ jsx(
      "link",
      {
        rel: "stylesheet",
        href,
        "data-adh-theme-import": DEFAULT_ADH_THEME
      },
      href
    )),
    /* @__PURE__ */ jsx(
      "style",
      {
        "data-adh-theme": DEFAULT_ADH_THEME,
        dangerouslySetInnerHTML: { __html: rest }
      }
    ),
    /* @__PURE__ */ jsx("script", { dangerouslySetInnerHTML: { __html: APPEARANCE_PREPAINT_SCRIPT } }),
    /* @__PURE__ */ jsx(SiteDefaultTheme, { baseImports: imports }),
    /* @__PURE__ */ jsx(ThemeSwitcherAssets, { defaultImports: imports })
  ] });
}

// src/themes/ThemeSwitcher.tsx
import { Palette } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@agenticdevelopertoolkit/ui/components/dropdown-menu";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function ThemeSwitcher({
  current,
  label = "Theme",
  onThemeChange
}) {
  const router = useRouter();
  const selectTheme = (key) => {
    const secureFlag = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${ADH_THEME_COOKIE}=${key}; path=/; max-age=31536000; samesite=lax${secureFlag}`;
    if (onThemeChange) {
      onThemeChange(key);
    } else {
      router.refresh();
    }
  };
  return /* @__PURE__ */ jsxs2(DropdownMenuSub, { children: [
    /* @__PURE__ */ jsxs2(DropdownMenuSubTrigger, { children: [
      /* @__PURE__ */ jsx2(Palette, { className: "adh-dropdown-menu__item-icon" }),
      /* @__PURE__ */ jsx2("span", { children: label })
    ] }),
    /* @__PURE__ */ jsx2(DropdownMenuSubContent, { children: /* @__PURE__ */ jsx2(
      DropdownMenuRadioGroup,
      {
        value: current ?? DEFAULT_ADH_THEME,
        onValueChange: (value) => selectTheme(value),
        children: ADH_THEMES.map((theme) => /* @__PURE__ */ jsx2(DropdownMenuRadioItem, { value: theme.key, children: theme.label }, theme.key))
      }
    ) })
  ] });
}

// src/themes/useThemeEditor.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { themes as themes3 } from "@agenticdevelopertoolkit/themes/manifest";

// src/themes/resolve.ts
function isSwitcherSeed(key) {
  return key != null && switcherThemeKeys().includes(key);
}
function concatItemCss(data) {
  return Object.values(data).map((s) => s.trim()).filter(Boolean).join("\n\n");
}

// src/themes/theme-overrides.ts
var OVERRIDE_ID = "adh-theme-edit";
var ROOT_SELECTOR_RE = /(^|})(\s*):root(\s*\{)/g;
var BOOSTED_ROOT = "html:root:root:root:root";
function boostRootSpecificity(css) {
  return css.replace(ROOT_SELECTOR_RE, (_m, pre, ws, brace) => `${pre}${ws}${BOOSTED_ROOT}${brace}`);
}
function applyThemeCss(css) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(OVERRIDE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = OVERRIDE_ID;
    document.head.appendChild(el);
  }
  el.textContent = boostRootSpecificity(css);
}
function clearThemeOverride() {
  if (typeof document === "undefined") return;
  document.getElementById(OVERRIDE_ID)?.remove();
}

// src/themes/useThemeEditor.ts
import { reportUnexpectedError } from "@agentic-toolkit/adh/telemetry/report-error";

// src/themes/themes-client.ts
var API = "/api";
async function readJson(res) {
  if (!res.ok) throw new Error(`themes API ${res.status}`);
  return await res.json();
}
var jsonInit = (method, body) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
});
async function listThemes() {
  const res = await fetch(`${API}/public/themes`, { cache: "no-store" });
  if (res.status === 404) return [];
  return readJson(res);
}
async function createTheme(theme) {
  return readJson(await fetch(`${API}/themes`, jsonInit("POST", theme)));
}
async function updateTheme(key, patch) {
  return readJson(await fetch(`${API}/themes/${encodeURIComponent(key)}`, jsonInit("PUT", patch)));
}
async function deleteTheme(key) {
  const res = await fetch(`${API}/themes/${encodeURIComponent(key)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`themes API ${res.status}`);
}

// src/themes/useThemeEditor.ts
var KEY_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
function seedThemes() {
  return switcherThemeKeys().map((k) => ({
    key: k,
    label: themes3[k].label,
    basedOn: null,
    source: "seed"
  }));
}
var concatCss = concatItemCss;
function clean(map) {
  return Object.fromEntries(Object.entries(map).filter(([, v]) => v.trim()));
}
function mapsEqual(a, b) {
  const ca = clean(a);
  const cb = clean(b);
  const ak = Object.keys(ca);
  return ak.length === Object.keys(cb).length && ak.every((k) => ca[k] === cb[k]);
}
function uniqueKey(base, taken) {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}
var baseSeedOf = (t) => t.source === "seed" ? t.key : isSwitcherSeed(t.basedOn) ? t.basedOn : DEFAULT_ADH_THEME;
function useThemeEditor() {
  const seeds = useMemo(seedThemes, []);
  const [dbRaw, setDbRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [draft, setDraft] = useState({});
  const [savedData, setSavedData] = useState({});
  const [label, setLabelState] = useState("");
  const [savedLabel, setSavedLabel] = useState("");
  const [themeKey, setThemeKeyState] = useState("");
  const [basedOn, setBasedOn] = useState(null);
  const [isSeed, setIsSeed] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setDbRaw(await listThemes());
      setError(null);
    } catch (e) {
      reportUnexpectedError(e, { feature: "theme-editor", step: "load" });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const allThemes = useMemo(() => {
    const list = [
      ...seeds,
      ...dbRaw.map((t) => ({ key: t.key, label: t.label, basedOn: t.basedOn, source: "db" }))
    ];
    if (isNew && selectedKey)
      list.push({ key: selectedKey, label, basedOn, source: "db" });
    return list;
  }, [seeds, dbRaw, isNew, selectedKey, label, basedOn]);
  const applyLive = useCallback((data, base) => {
    applyBaseTheme(base);
    applyThemeCss(concatCss(data));
  }, []);
  const select = useCallback(
    (key) => {
      if (key == null) {
        setSelectedKey(null);
        setDraft({});
        setSavedData({});
        setIsNew(false);
        setIsSeed(false);
        clearThemeOverride();
        return;
      }
      const seed = seeds.find((s) => s.key === key);
      const db = dbRaw.find((t) => t.key === key);
      if (!seed && !db) return;
      const data = db ? { ...db.data } : {};
      const based = seed ? key : db?.basedOn ?? null;
      setSelectedKey(key);
      setIsSeed(!!seed);
      setIsNew(false);
      setLabelState(db?.label ?? seed?.label ?? key);
      setSavedLabel(db?.label ?? seed?.label ?? key);
      setThemeKeyState(key);
      setBasedOn(based);
      setDraft(data);
      setSavedData({ ...data });
      applyLive(data, seed ? key : baseSeedOf({ source: "db", key, basedOn: based }));
      persistTheme(key);
    },
    [seeds, dbRaw, applyLive]
  );
  const [autoSelected, setAutoSelected] = useState(false);
  useEffect(() => {
    if (autoSelected || loading) return;
    setAutoSelected(true);
    const stored = readStoredTheme();
    const key = stored && allThemes.some((t) => t.key === stored) ? stored : DEFAULT_SITE_THEME;
    select(key);
  }, [autoSelected, loading, allThemes, select]);
  const promoteSeedToDraft = useCallback(
    (seedKey, firstEdit) => {
      const newKey = uniqueKey(`${seedKey}-custom`, new Set(allThemes.map((t) => t.key)));
      setSelectedKey(newKey);
      setThemeKeyState(newKey);
      setIsSeed(false);
      setIsNew(true);
      setBasedOn(seedKey);
      setLabelState((l) => `${l} copy`);
      setSavedLabel("");
      setSavedData({});
      setDraft(firstEdit);
      applyThemeCss(concatCss(firstEdit));
    },
    [allThemes]
  );
  const setItemCss = useCallback(
    (itemId, css) => {
      if (isSeed && selectedKey) {
        promoteSeedToDraft(selectedKey, { [itemId]: css });
        return;
      }
      setDraft((prev) => {
        const next = { ...prev, [itemId]: css };
        applyThemeCss(concatCss(next));
        return next;
      });
    },
    [isSeed, selectedKey, promoteSeedToDraft]
  );
  const newTheme = useCallback(() => {
    const taken = new Set(allThemes.map((t) => t.key));
    const key = uniqueKey("custom", taken);
    const based = (selectedKey ? allThemes.find((t) => t.key === selectedKey) : void 0)?.basedOn ?? (isSwitcherSeed(selectedKey) ? selectedKey : DEFAULT_ADH_THEME);
    setSelectedKey(key);
    setIsSeed(false);
    setIsNew(true);
    setLabelState("New theme");
    setSavedLabel("");
    setThemeKeyState(key);
    setBasedOn(based);
    setDraft({});
    setSavedData({});
    applyLive({}, isSwitcherSeed(based) ? based : DEFAULT_ADH_THEME);
  }, [allThemes, selectedKey, applyLive]);
  const dirty = useMemo(() => {
    if (isSeed) return false;
    if (isNew) return Object.keys(clean(draft)).length > 0 || label.trim().length > 0;
    return !mapsEqual(draft, savedData) || label !== savedLabel;
  }, [isSeed, isNew, draft, savedData, label, savedLabel]);
  const keyValid = KEY_RE.test(themeKey) && !allThemes.some((t) => t.key === themeKey && t.key !== selectedKey);
  const canSave = !isSeed && dirty && label.trim().length > 0 && (!isNew || keyValid);
  const canDelete = !isSeed && !isNew && selectedKey != null;
  const savingRef = useRef(false);
  const save = useCallback(async () => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const data = clean(draft);
      if (isNew) {
        await createTheme({ key: themeKey, label: label.trim(), basedOn, data });
        await reload();
        setIsNew(false);
        setSavedData({ ...data });
        setSavedLabel(label.trim());
        setSelectedKey(themeKey);
      } else if (selectedKey) {
        await updateTheme(selectedKey, { label: label.trim(), basedOn, data });
        await reload();
        setSavedData({ ...data });
        setSavedLabel(label.trim());
      }
      return true;
    } catch (e) {
      reportUnexpectedError(e, { feature: "theme-editor", step: "save" });
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [draft, isNew, themeKey, label, basedOn, selectedKey, reload]);
  const remove = useCallback(async () => {
    if (!selectedKey || isSeed || isNew) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTheme(selectedKey);
      await reload();
      select(null);
    } catch (e) {
      reportUnexpectedError(e, { feature: "theme-editor", step: "delete" });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [selectedKey, isSeed, isNew, reload, select]);
  const cancel = useCallback(() => {
    if (isNew) {
      select(null);
      return;
    }
    setLabelState(savedLabel);
    setDraft({ ...savedData });
    applyThemeCss(concatCss(savedData));
  }, [isNew, savedLabel, savedData, select]);
  const itemCss = useCallback((itemId) => draft[itemId] ?? "", [draft]);
  const exportCss = useCallback(() => concatCss(draft), [draft]);
  return {
    loading,
    error,
    themes: allThemes,
    selectedKey,
    isSeed,
    isNew,
    label,
    themeKey,
    basedOn,
    dirty,
    canSave,
    canDelete,
    saving,
    itemCss,
    select,
    setItemCss,
    setLabel: setLabelState,
    setThemeKey: setThemeKeyState,
    newTheme,
    save,
    remove,
    cancel,
    exportCss
  };
}

// src/themes/index.ts
import { DbThemeApplier as DbThemeApplier2 } from "@agentic-toolkit/adh/themes/DbThemeApplier";
export {
  ADH_THEMES,
  ADH_THEME_COOKIE,
  ALT_STYLE_SELECTOR,
  AdhThemeStyle,
  DEFAULT_ADH_THEME,
  DEFAULT_SITE_THEME,
  DbThemeApplier2 as DbThemeApplier,
  FULL_PALETTE_THEMES,
  THEME_STORAGE_KEY,
  ThemeSwitcher,
  appendThemePreview,
  applyBaseTheme,
  applyThemeCss,
  clearThemeOverride,
  concatItemCss,
  cookieDomain,
  createTheme,
  deleteTheme,
  isFullPaletteTheme,
  isSwitcherSeed,
  listThemes,
  persistTheme,
  readPreviewTheme,
  readStoredTheme,
  switcherThemeKeys,
  themePrePaintScript,
  updateTheme,
  useThemeEditor
};
//# sourceMappingURL=index.js.map