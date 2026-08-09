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
var DEFAULT_SITE_THEME = "charcoal";
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
export {
  ALT_STYLE_SELECTOR,
  THEME_STORAGE_KEY,
  appendThemePreview,
  applyBaseTheme,
  cookieDomain,
  persistTheme,
  readPreviewTheme,
  readStoredTheme,
  themePrePaintScript
};
//# sourceMappingURL=theme-preview.js.map