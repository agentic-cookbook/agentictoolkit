'use client'

"use client";

// src/themes/DbThemeApplier.tsx
import { useEffect } from "react";

// src/themes/adh-themes.ts
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
var BASE_FACE_THEMES = [
  DEFAULT_ADH_THEME,
  ...BASE_CUT_ALIASES,
  "charcoal",
  "fishlamp"
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
function readStoredTheme() {
  const m = document.cookie.match(/(?:^|; )adh-theme=([^;]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

// src/themes/theme-keys.ts
import { themes } from "@agenticdevelopertoolkit/themes/manifest";
var adhThemeKeys = () => Object.keys(themes).filter(
  (k) => k.startsWith("adh") && !isBaseCutAlias(k)
);
var switcherThemeKeys = () => [
  ...adhThemeKeys(),
  ...FULL_PALETTE_THEMES
];

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

// src/themes/themes-client.ts
var API = "/api";
async function readJson(res) {
  if (!res.ok) throw new Error(`themes API ${res.status}`);
  return await res.json();
}
async function listThemes() {
  const res = await fetch(`${API}/public/themes`, { cache: "no-store" });
  if (res.status === 404) return [];
  return readJson(res);
}

// src/themes/DbThemeApplier.tsx
function DbThemeApplier() {
  useEffect(() => {
    if (!document.querySelector(ALT_STYLE_SELECTOR)) return;
    const key = readStoredTheme();
    if (!key || isSwitcherSeed(key)) return;
    let cancelled = false;
    void listThemes().then((rows) => {
      if (cancelled) return;
      const t = rows.find((r) => r.key === key);
      if (!t) return;
      applyBaseTheme(isSwitcherSeed(t.basedOn) ? t.basedOn : DEFAULT_ADH_THEME);
      applyThemeCss(concatItemCss(t.data));
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
export {
  DbThemeApplier
};
//# sourceMappingURL=DbThemeApplier.js.map