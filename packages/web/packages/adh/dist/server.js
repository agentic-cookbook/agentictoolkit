// src/themes/getAdhTheme.ts
import { cookies } from "next/headers";

// src/themes/adh-themes.ts
var ADH_THEME_COOKIE = "adh-theme";
var ADH_THEMES = [
  { key: "adh", label: "ADH" },
  { key: "adh-iosevka", label: "Iosevka" },
  { key: "adh-manrope", label: "Manrope" },
  { key: "adh-courier", label: "Courier" },
  { key: "adh-comic", label: "Comic" },
  { key: "adh-jetbrains", label: "JetBrains" },
  { key: "adh-fira", label: "Fira" }
];
var DEFAULT_ADH_THEME = "adh-manrope";

// src/themes/getAdhTheme.ts
var VALID_KEYS = new Set(ADH_THEMES.map((t) => t.key));
async function getAdhTheme() {
  const store = await cookies();
  const raw = store.get(ADH_THEME_COOKIE)?.value;
  if (raw && VALID_KEYS.has(raw)) return raw;
  return DEFAULT_ADH_THEME;
}

// src/themes/AdhThemeStyle.tsx
import { themes } from "@agentic-toolkit/themes/manifest";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var IMPORT_URL_RE = /@import\s+url\(\s*(['"]?)([^'")]+)\1\s*\)\s*;?/g;
function splitImports(css) {
  const imports = [];
  const rest = css.replace(IMPORT_URL_RE, (_, _q, href) => {
    imports.push(href);
    return "";
  });
  return { imports, rest };
}
function AdhThemeStyle({ themeKey }) {
  const entry = themes[themeKey];
  if (!entry) return null;
  const { imports, rest } = splitImports(entry.css);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    imports.map((href) => /* @__PURE__ */ jsx("link", { rel: "stylesheet", href, "data-adh-theme-import": themeKey }, href)),
    /* @__PURE__ */ jsx("style", { "data-adh-theme": themeKey, dangerouslySetInnerHTML: { __html: rest } })
  ] });
}
export {
  ADH_THEMES,
  ADH_THEME_COOKIE,
  AdhThemeStyle,
  DEFAULT_ADH_THEME,
  getAdhTheme
};
//# sourceMappingURL=server.js.map