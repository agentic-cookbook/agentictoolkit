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

// src/components/ui/dropdown-menu.tsx
import * as React2 from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function joinClasses2(...parts) {
  return parts.filter(Boolean).join(" ");
}
var DropdownMenu = DropdownMenuPrimitive.Root;
var DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
var DropdownMenuPortal = DropdownMenuPrimitive.Portal;
var DropdownMenuSub = DropdownMenuPrimitive.Sub;
var DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;
var DropdownMenuSubTrigger = React2.forwardRef(({ className, inset, children, ...props }, ref) => /* @__PURE__ */ jsxs(
  DropdownMenuPrimitive.SubTrigger,
  {
    ref,
    className: joinClasses2(
      "adh-dropdown-menu__item adh-dropdown-menu__sub-trigger",
      inset && "adh-dropdown-menu__item--inset",
      className
    ),
    ...props,
    children: [
      children,
      /* @__PURE__ */ jsx2(ChevronRight, { className: "adh-dropdown-menu__sub-trigger-chevron" })
    ]
  }
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;
var DropdownMenuSubContent = React2.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx2(
  DropdownMenuPrimitive.SubContent,
  {
    ref,
    className: joinClasses2("adh-dropdown-menu__content", className),
    ...props
  }
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;
var DropdownMenuContent = React2.forwardRef(({ className, sideOffset = 4, ...props }, ref) => /* @__PURE__ */ jsx2(DropdownMenuPrimitive.Portal, { children: /* @__PURE__ */ jsx2(
  DropdownMenuPrimitive.Content,
  {
    ref,
    sideOffset,
    className: joinClasses2("adh-dropdown-menu__content", className),
    ...props
  }
) }));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;
var DropdownMenuItem = React2.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ jsx2(
  DropdownMenuPrimitive.Item,
  {
    ref,
    className: joinClasses2(
      "adh-dropdown-menu__item",
      inset && "adh-dropdown-menu__item--inset",
      className
    ),
    ...props
  }
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;
var DropdownMenuCheckboxItem = React2.forwardRef(({ className, children, checked, ...props }, ref) => /* @__PURE__ */ jsxs(
  DropdownMenuPrimitive.CheckboxItem,
  {
    ref,
    className: joinClasses2(
      "adh-dropdown-menu__item adh-dropdown-menu__item--indicator-left",
      className
    ),
    checked,
    ...props,
    children: [
      /* @__PURE__ */ jsx2("span", { className: "adh-dropdown-menu__indicator-slot", children: /* @__PURE__ */ jsx2(DropdownMenuPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx2(Check, { className: "adh-dropdown-menu__indicator-check" }) }) }),
      children
    ]
  }
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;
var DropdownMenuRadioItem = React2.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs(
  DropdownMenuPrimitive.RadioItem,
  {
    ref,
    className: joinClasses2(
      "adh-dropdown-menu__item adh-dropdown-menu__item--indicator-left",
      className
    ),
    ...props,
    children: [
      /* @__PURE__ */ jsx2("span", { className: "adh-dropdown-menu__indicator-slot", children: /* @__PURE__ */ jsx2(DropdownMenuPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx2(Circle, { className: "adh-dropdown-menu__indicator-dot" }) }) }),
      children
    ]
  }
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;
var DropdownMenuLabel = React2.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ jsx2(
  DropdownMenuPrimitive.Label,
  {
    ref,
    className: joinClasses2(
      "adh-dropdown-menu__label",
      inset && "adh-dropdown-menu__item--inset",
      className
    ),
    ...props
  }
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;
var DropdownMenuSeparator = React2.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx2(
  DropdownMenuPrimitive.Separator,
  {
    ref,
    className: joinClasses2("adh-dropdown-menu__separator", className),
    ...props
  }
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;
var DropdownMenuShortcut = ({ className, ...props }) => {
  return /* @__PURE__ */ jsx2(
    "span",
    {
      className: joinClasses2("adh-dropdown-menu__shortcut", className),
      ...props
    }
  );
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

// src/themes/ThemeSwitcher.tsx
import { Palette } from "lucide-react";
import { useRouter } from "next/navigation";

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

// src/themes/ThemeSwitcher.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
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
      /* @__PURE__ */ jsx3(Palette, { className: "adh-dropdown-menu__item-icon" }),
      /* @__PURE__ */ jsx3("span", { children: label })
    ] }),
    /* @__PURE__ */ jsx3(DropdownMenuPortal, { children: /* @__PURE__ */ jsx3(DropdownMenuSubContent, { children: /* @__PURE__ */ jsx3(
      DropdownMenuRadioGroup,
      {
        value: current ?? DEFAULT_ADH_THEME,
        onValueChange: (value) => selectTheme(value),
        children: ADH_THEMES.map((theme) => /* @__PURE__ */ jsx3(DropdownMenuRadioItem, { value: theme.key, children: theme.label }, theme.key))
      }
    ) }) })
  ] });
}

// src/debug/ChatThemeSwitcher.tsx
import { MessageSquare } from "lucide-react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var DEFAULT_VALUE = "__default";
function ChatThemeSwitcher({
  themes,
  current,
  onChange,
  label = "Chat theme"
}) {
  return /* @__PURE__ */ jsxs3(DropdownMenuSub, { children: [
    /* @__PURE__ */ jsxs3(DropdownMenuSubTrigger, { children: [
      /* @__PURE__ */ jsx4(MessageSquare, { className: "adh-dropdown-menu__item-icon" }),
      /* @__PURE__ */ jsx4("span", { children: label })
    ] }),
    /* @__PURE__ */ jsx4(DropdownMenuPortal, { children: /* @__PURE__ */ jsx4(DropdownMenuSubContent, { children: /* @__PURE__ */ jsxs3(
      DropdownMenuRadioGroup,
      {
        value: current ?? DEFAULT_VALUE,
        onValueChange: (value) => onChange(value === DEFAULT_VALUE ? null : value),
        children: [
          /* @__PURE__ */ jsx4(DropdownMenuRadioItem, { value: DEFAULT_VALUE, children: "App default" }),
          themes.map((theme) => /* @__PURE__ */ jsx4(DropdownMenuRadioItem, { value: theme.key, children: theme.label }, theme.key))
        ]
      }
    ) }) })
  ] });
}

// src/debug/DebugMenu.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function DebugMenu({ themeKey, chat }) {
  return /* @__PURE__ */ jsx5("div", { className: "adh-debug-menu", children: /* @__PURE__ */ jsxs4(DropdownMenu, { children: [
    /* @__PURE__ */ jsx5(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx5(Button, { variant: "ghost", size: "sm", "aria-label": "Debug menu", children: /* @__PURE__ */ jsx5(Bug, { className: "adh-button__icon" }) }) }),
    /* @__PURE__ */ jsxs4(DropdownMenuContent, { align: "start", side: "bottom", children: [
      /* @__PURE__ */ jsx5(DropdownMenuLabel, { children: "Debug" }),
      /* @__PURE__ */ jsx5(DropdownMenuSeparator, {}),
      /* @__PURE__ */ jsx5(ThemeSwitcher, { current: themeKey }),
      chat && /* @__PURE__ */ jsx5(
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