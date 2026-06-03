'use client'

// src/themes/ThemeSwitcher.tsx
import { Palette } from "lucide-react";
import { useRouter } from "next/navigation";

// src/components/ui/dropdown-menu.tsx
import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";
function joinClasses(...parts) {
  return parts.filter(Boolean).join(" ");
}
var DropdownMenuPortal = DropdownMenuPrimitive.Portal;
var DropdownMenuSub = DropdownMenuPrimitive.Sub;
var DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;
var DropdownMenuSubTrigger = React.forwardRef(({ className, inset, children, ...props }, ref) => /* @__PURE__ */ jsxs(
  DropdownMenuPrimitive.SubTrigger,
  {
    ref,
    className: joinClasses(
      "adh-dropdown-menu__item adh-dropdown-menu__sub-trigger",
      inset && "adh-dropdown-menu__item--inset",
      className
    ),
    ...props,
    children: [
      children,
      /* @__PURE__ */ jsx(ChevronRight, { className: "adh-dropdown-menu__sub-trigger-chevron" })
    ]
  }
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;
var DropdownMenuSubContent = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  DropdownMenuPrimitive.SubContent,
  {
    ref,
    className: joinClasses("adh-dropdown-menu__content", className),
    ...props
  }
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;
var DropdownMenuContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => /* @__PURE__ */ jsx(DropdownMenuPrimitive.Portal, { children: /* @__PURE__ */ jsx(
  DropdownMenuPrimitive.Content,
  {
    ref,
    sideOffset,
    className: joinClasses("adh-dropdown-menu__content", className),
    ...props
  }
) }));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;
var DropdownMenuItem = React.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ jsx(
  DropdownMenuPrimitive.Item,
  {
    ref,
    className: joinClasses(
      "adh-dropdown-menu__item",
      inset && "adh-dropdown-menu__item--inset",
      className
    ),
    ...props
  }
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;
var DropdownMenuCheckboxItem = React.forwardRef(({ className, children, checked, ...props }, ref) => /* @__PURE__ */ jsxs(
  DropdownMenuPrimitive.CheckboxItem,
  {
    ref,
    className: joinClasses(
      "adh-dropdown-menu__item adh-dropdown-menu__item--indicator-left",
      className
    ),
    checked,
    ...props,
    children: [
      /* @__PURE__ */ jsx("span", { className: "adh-dropdown-menu__indicator-slot", children: /* @__PURE__ */ jsx(DropdownMenuPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx(Check, { className: "adh-dropdown-menu__indicator-check" }) }) }),
      children
    ]
  }
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;
var DropdownMenuRadioItem = React.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs(
  DropdownMenuPrimitive.RadioItem,
  {
    ref,
    className: joinClasses(
      "adh-dropdown-menu__item adh-dropdown-menu__item--indicator-left",
      className
    ),
    ...props,
    children: [
      /* @__PURE__ */ jsx("span", { className: "adh-dropdown-menu__indicator-slot", children: /* @__PURE__ */ jsx(DropdownMenuPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx(Circle, { className: "adh-dropdown-menu__indicator-dot" }) }) }),
      children
    ]
  }
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;
var DropdownMenuLabel = React.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ jsx(
  DropdownMenuPrimitive.Label,
  {
    ref,
    className: joinClasses(
      "adh-dropdown-menu__label",
      inset && "adh-dropdown-menu__item--inset",
      className
    ),
    ...props
  }
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;
var DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  DropdownMenuPrimitive.Separator,
  {
    ref,
    className: joinClasses("adh-dropdown-menu__separator", className),
    ...props
  }
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;
var DropdownMenuShortcut = ({ className, ...props }) => {
  return /* @__PURE__ */ jsx(
    "span",
    {
      className: joinClasses("adh-dropdown-menu__shortcut", className),
      ...props
    }
  );
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

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
    /* @__PURE__ */ jsx2(DropdownMenuPortal, { children: /* @__PURE__ */ jsx2(DropdownMenuSubContent, { children: /* @__PURE__ */ jsx2(
      DropdownMenuRadioGroup,
      {
        value: current ?? DEFAULT_ADH_THEME,
        onValueChange: (value) => selectTheme(value),
        children: ADH_THEMES.map((theme) => /* @__PURE__ */ jsx2(DropdownMenuRadioItem, { value: theme.key, children: theme.label }, theme.key))
      }
    ) }) })
  ] });
}
export {
  ADH_THEMES,
  ADH_THEME_COOKIE,
  DEFAULT_ADH_THEME,
  ThemeSwitcher
};
//# sourceMappingURL=index.js.map