"use client";

"use client";

// src/settings/ThemePickerRow.tsx
import { useEffect, useState } from "react";
import {
  applyBaseTheme,
  persistTheme,
  readStoredTheme
} from "@agentic-toolkit/adh/themes/theme-preview";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { SettingRow } from "@agentic-toolkit/account";
import { jsx, jsxs } from "react/jsx-runtime";
function readAltThemes() {
  const nodes = document.querySelectorAll("style[data-adh-theme-alt]");
  return [...nodes].map((el) => {
    const key = el.getAttribute("data-adh-theme-alt") ?? "";
    return { key, label: el.getAttribute("data-adh-theme-label") || key };
  }).filter((t) => t.key !== "").sort((a, b) => a.label.localeCompare(b.label));
}
function activeAltTheme() {
  const el = document.querySelector(
    'style[data-adh-theme-alt][media="all"]'
  );
  return el?.getAttribute("data-adh-theme-alt") ?? null;
}
function baseTheme() {
  const el = document.querySelector("style[data-adh-theme]");
  return el?.getAttribute("data-adh-theme") ?? null;
}
function ThemePickerRow() {
  const [themes, setThemes] = useState([]);
  const [current, setCurrent] = useState("");
  useEffect(() => {
    const alts = readAltThemes();
    setThemes(alts);
    const known = new Set(alts.map((t) => t.key));
    const seed = [activeAltTheme(), readStoredTheme(), baseTheme()].find(
      (k) => k != null && known.has(k)
    );
    setCurrent(seed ?? "");
  }, []);
  if (themes.length === 0) return null;
  const select = (key) => {
    applyBaseTheme(key);
    persistTheme(key);
    setCurrent(key);
  };
  return /* @__PURE__ */ jsx(
    SettingRow,
    {
      label: "Theme",
      description: "Preview a theme on this device. Development builds only.",
      children: /* @__PURE__ */ jsxs(
        Select,
        {
          "aria-label": "Theme",
          className: "sm:w-56",
          value: current,
          onChange: (e) => select(e.target.value),
          children: [
            current === "" ? /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "(theme in use is not listed)" }) : null,
            themes.map((t) => /* @__PURE__ */ jsx("option", { value: t.key, children: t.label }, t.key))
          ]
        }
      )
    }
  );
}
export {
  ThemePickerRow as default
};
//# sourceMappingURL=ThemePickerRow.js.map