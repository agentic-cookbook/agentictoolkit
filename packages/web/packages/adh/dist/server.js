// src/themes/getAdhTheme.ts
import { cookies } from "next/headers";

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
  // The ADH family's own two. `charcoal` is the palette the family wore by default until
  // `fishlamp` replaced it below — saved as a theme in its own right so the old look stays
  // pickable and recoverable rather than living only in the base theme it is layered over.
  "charcoal",
  "fishlamp"
];
var DEFAULT_SITE_THEME = "fishlamp";
var BASE_FACE_THEMES = [
  DEFAULT_ADH_THEME,
  ...BASE_CUT_ALIASES,
  "charcoal",
  "fishlamp"
];
var usesBaseThemeFonts = (key) => BASE_FACE_THEMES.includes(key);
var isFullPaletteTheme = (key) => FULL_PALETTE_THEMES.includes(key);

// src/themes/getAdhTheme.ts
var VALID_KEYS = new Set(ADH_THEMES.map((t) => t.key));
async function getAdhTheme() {
  const store = await cookies();
  const raw = store.get(ADH_THEME_COOKIE)?.value;
  if (raw && VALID_KEYS.has(raw)) return raw;
  return DEFAULT_ADH_THEME;
}

// src/themes/AdhThemeStyle.tsx
import dynamic from "next/dynamic";
import { preload } from "react-dom";
import { themes as themes2 } from "@agentic-toolkit/themes/manifest";
import { splitImports, parseRootProps } from "@agentic-toolkit/themes/tokens";
import { APPEARANCE_PREPAINT_SCRIPT } from "@agentic-toolkit/themes/appearance";
import { THEME_FONT_PRELOADS } from "@agentic-toolkit/themes/fonts";

// src/themes/theme-keys.ts
import { themes } from "@agentic-toolkit/themes/manifest";
var adhThemeKeys = () => Object.keys(themes).filter(
  (k) => k.startsWith("adh") && !isBaseCutAlias(k)
);
var switcherThemeKeys = () => [
  ...adhThemeKeys(),
  ...FULL_PALETTE_THEMES
];

// src/themes/theme-preview.ts
var THEME_STORAGE_KEY = "adh-theme";
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
export {
  ADH_THEMES,
  ADH_THEME_COOKIE,
  AdhThemeStyle,
  DEFAULT_ADH_THEME,
  DEFAULT_SITE_THEME,
  getAdhTheme
};
//# sourceMappingURL=server.js.map