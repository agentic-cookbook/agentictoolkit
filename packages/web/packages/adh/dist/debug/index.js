'use client'

// src/debug/DebugMenu.tsx
import { Bug } from "lucide-react";

// src/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { jsx } from "react/jsx-runtime";
function joinClasses(...parts) {
  return parts.filter(Boolean).join(" ");
}
var Button = React.forwardRef(
  ({ className, variant = "default", size = "default", asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return /* @__PURE__ */ jsx(
      Comp,
      {
        className: joinClasses(
          "adh-button",
          `adh-button--${variant}`,
          `adh-button--size-${size}`,
          className
        ),
        ref,
        type: asChild ? type : type ?? "button",
        ...props
      }
    );
  }
);
Button.displayName = "Button";

// src/debug/DebugMenu.tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@agenticdevelopertoolkit/ui/components/dropdown-menu";

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
var BASE_FACE_THEMES = [
  DEFAULT_ADH_THEME,
  ...BASE_CUT_ALIASES,
  "charcoal",
  "fishlamp"
];

// src/themes/ThemeSwitcher.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(DropdownMenuSub, { children: [
    /* @__PURE__ */ jsxs(DropdownMenuSubTrigger, { children: [
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

// src/debug/ChatThemeSwitcher.tsx
import { MessageSquare } from "lucide-react";
import {
  DropdownMenuSub as DropdownMenuSub2,
  DropdownMenuSubTrigger as DropdownMenuSubTrigger2,
  DropdownMenuSubContent as DropdownMenuSubContent2,
  DropdownMenuRadioGroup as DropdownMenuRadioGroup2,
  DropdownMenuRadioItem as DropdownMenuRadioItem2
} from "@agenticdevelopertoolkit/ui/components/dropdown-menu";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var DEFAULT_VALUE = "__default";
function ChatThemeSwitcher({
  themes,
  current,
  onChange,
  label = "Chat theme"
}) {
  return /* @__PURE__ */ jsxs2(DropdownMenuSub2, { children: [
    /* @__PURE__ */ jsxs2(DropdownMenuSubTrigger2, { children: [
      /* @__PURE__ */ jsx3(MessageSquare, { className: "adh-dropdown-menu__item-icon" }),
      /* @__PURE__ */ jsx3("span", { children: label })
    ] }),
    /* @__PURE__ */ jsx3(DropdownMenuSubContent2, { children: /* @__PURE__ */ jsxs2(
      DropdownMenuRadioGroup2,
      {
        value: current ?? DEFAULT_VALUE,
        onValueChange: (value) => onChange(value === DEFAULT_VALUE ? null : value),
        children: [
          /* @__PURE__ */ jsx3(DropdownMenuRadioItem2, { value: DEFAULT_VALUE, children: "App default" }),
          themes.map((theme) => /* @__PURE__ */ jsx3(DropdownMenuRadioItem2, { value: theme.key, children: theme.label }, theme.key))
        ]
      }
    ) })
  ] });
}

// src/debug/DebugMenu.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function DebugMenu({ themeKey, chat }) {
  return /* @__PURE__ */ jsx4("div", { className: "adh-debug-menu", children: /* @__PURE__ */ jsxs3(DropdownMenu, { children: [
    /* @__PURE__ */ jsx4(
      DropdownMenuTrigger,
      {
        render: /* @__PURE__ */ jsx4(Button, { variant: "ghost", size: "sm", "aria-label": "Debug menu" }),
        children: /* @__PURE__ */ jsx4(Bug, { className: "adh-button__icon" })
      }
    ),
    /* @__PURE__ */ jsxs3(DropdownMenuContent, { align: "start", side: "bottom", children: [
      /* @__PURE__ */ jsx4(DropdownMenuLabel, { children: "Debug" }),
      /* @__PURE__ */ jsx4(DropdownMenuSeparator, {}),
      /* @__PURE__ */ jsx4(ThemeSwitcher, { current: themeKey }),
      chat && /* @__PURE__ */ jsx4(
        ChatThemeSwitcher,
        {
          themes: chat.themes,
          current: chat.current,
          onChange: chat.onChange,
          label: chat.label
        }
      )
    ] })
  ] }) });
}
export {
  ChatThemeSwitcher,
  DebugMenu
};
//# sourceMappingURL=index.js.map