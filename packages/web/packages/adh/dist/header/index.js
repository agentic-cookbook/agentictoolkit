'use client'

"use client";

// src/header/AdhHeader.tsx
import Link3 from "next/link";

// src/header/AvatarMenu.tsx
import Link2 from "next/link";
import { usePathname as usePathname2 } from "next/navigation";
import { ChevronDown, LogOut, Settings, User as UserIcon } from "lucide-react";

// src/components/ui/avatar.tsx
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { jsx } from "react/jsx-runtime";
function joinClasses(...parts) {
  return parts.filter(Boolean).join(" ");
}
var Avatar = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  AvatarPrimitive.Root,
  {
    ref,
    className: joinClasses("adh-avatar", className),
    ...props
  }
));
Avatar.displayName = AvatarPrimitive.Root.displayName;
var AvatarImage = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  AvatarPrimitive.Image,
  {
    ref,
    className: joinClasses("adh-avatar__image", className),
    ...props
  }
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;
var AvatarFallback = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  AvatarPrimitive.Fallback,
  {
    ref,
    className: joinClasses("adh-avatar__fallback", className),
    ...props
  }
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

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

// src/header/NavLink.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { jsx as jsx3 } from "react/jsx-runtime";
function pathMatches(pathname, pattern) {
  if (pattern === pathname) return true;
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  return false;
}
function NavLinkItem({ link }) {
  const pathname = usePathname() ?? "";
  const matchers = link.matchPaths ?? [link.href];
  const active = matchers.some((m) => pathMatches(pathname, m));
  return /* @__PURE__ */ jsx3(
    Link,
    {
      href: link.href,
      "aria-current": active ? "page" : void 0,
      className: "adh-header__nav-link",
      "data-active": active ? "" : void 0,
      children: link.label
    }
  );
}

// src/header/AvatarMenu.tsx
import { Fragment, jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
function initialsOf(name) {
  if (!name) return "";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}
function AvatarMenu({
  user,
  navLinks = [],
  onLogout,
  settingsHref,
  onSettings,
  children
}) {
  const pathname = usePathname2() ?? "";
  const avatarInner = /* @__PURE__ */ jsxs2(Avatar, { className: "adh-avatar-menu-trigger__avatar", children: [
    user.imageUrl && /* @__PURE__ */ jsx4(AvatarImage, { src: user.imageUrl, alt: user.name }),
    /* @__PURE__ */ jsx4(AvatarFallback, { children: initialsOf(user.name) || /* @__PURE__ */ jsx4(UserIcon, { className: "adh-avatar-menu-trigger__fallback-icon" }) })
  ] });
  const settingsItem = settingsHref ? /* @__PURE__ */ jsx4(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsxs2(Link2, { href: settingsHref, className: "adh-avatar-menu__item", children: [
    /* @__PURE__ */ jsx4("span", { className: "adh-avatar-menu__item-label", children: "Settings" }),
    /* @__PURE__ */ jsx4(Settings, { className: "adh-avatar-menu__item-icon" })
  ] }) }) : onSettings ? /* @__PURE__ */ jsxs2(DropdownMenuItem, { onSelect: onSettings, className: "adh-avatar-menu__item", children: [
    /* @__PURE__ */ jsx4("span", { className: "adh-avatar-menu__item-label", children: "Settings" }),
    /* @__PURE__ */ jsx4(Settings, { className: "adh-avatar-menu__item-icon" })
  ] }) : null;
  return /* @__PURE__ */ jsxs2(DropdownMenu, { children: [
    /* @__PURE__ */ jsxs2(
      DropdownMenuTrigger,
      {
        className: "adh-avatar-menu-trigger",
        "aria-label": `Open ${user.name} menu`,
        children: [
          /* @__PURE__ */ jsx4("span", { className: "adh-avatar-menu-trigger__name", children: user.name }),
          /* @__PURE__ */ jsx4("span", { className: "adh-avatar-menu-trigger__avatar-wrap", children: avatarInner }),
          /* @__PURE__ */ jsx4("span", { className: "adh-avatar-menu-trigger__chevron", "aria-hidden": "true", children: /* @__PURE__ */ jsx4(ChevronDown, { className: "adh-avatar-menu-trigger__chevron-icon" }) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs2(DropdownMenuContent, { className: "adh-avatar-menu", align: "end", sideOffset: 8, children: [
      /* @__PURE__ */ jsx4("div", { className: "adh-avatar-menu__header", children: /* @__PURE__ */ jsxs2("div", { className: "adh-avatar-menu__identity", children: [
        /* @__PURE__ */ jsx4("span", { className: "adh-avatar-menu__name", children: user.name }),
        user.email && /* @__PURE__ */ jsx4("span", { className: "adh-avatar-menu__email", children: user.email })
      ] }) }),
      navLinks.length > 0 && /* @__PURE__ */ jsxs2(Fragment, { children: [
        /* @__PURE__ */ jsx4(DropdownMenuSeparator, {}),
        navLinks.map((link) => {
          const Icon = link.icon;
          const matchers = link.matchPaths ?? [link.href];
          const active = matchers.some((m) => pathMatches(pathname, m));
          return /* @__PURE__ */ jsx4(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsxs2(
            Link2,
            {
              href: link.href,
              className: "adh-avatar-menu__item",
              "aria-current": active ? "page" : void 0,
              "data-active": active ? "" : void 0,
              children: [
                /* @__PURE__ */ jsx4("span", { className: "adh-avatar-menu__item-label", children: link.label }),
                Icon ? /* @__PURE__ */ jsx4(Icon, { className: "adh-avatar-menu__item-icon" }) : null
              ]
            }
          ) }, link.href + link.label);
        })
      ] }),
      settingsItem && /* @__PURE__ */ jsxs2(Fragment, { children: [
        /* @__PURE__ */ jsx4(DropdownMenuSeparator, {}),
        settingsItem
      ] }),
      children && /* @__PURE__ */ jsxs2(Fragment, { children: [
        /* @__PURE__ */ jsx4(DropdownMenuSeparator, {}),
        children
      ] }),
      onLogout && /* @__PURE__ */ jsxs2(Fragment, { children: [
        /* @__PURE__ */ jsx4(DropdownMenuSeparator, {}),
        /* @__PURE__ */ jsxs2(
          DropdownMenuItem,
          {
            onSelect: onLogout,
            className: "adh-avatar-menu__item",
            children: [
              /* @__PURE__ */ jsx4("span", { className: "adh-avatar-menu__item-label", children: "Log out" }),
              /* @__PURE__ */ jsx4(LogOut, { className: "adh-avatar-menu__item-icon" })
            ]
          }
        )
      ] })
    ] })
  ] });
}

// src/header/AuthButtons.tsx
import { Fragment as Fragment2, jsx as jsx5, jsxs as jsxs3 } from "react/jsx-runtime";
function AuthButtons({
  onSignup,
  onLogin,
  signupHref,
  loginHref,
  signupLabel = "signup",
  loginLabel = "login"
}) {
  const loginNode = onLogin ? /* @__PURE__ */ jsx5("button", { type: "button", onClick: onLogin, className: "adh-header__nav-link adh-header__nav-link--button", children: loginLabel }) : loginHref ? /* @__PURE__ */ jsx5("a", { href: loginHref, className: "adh-header__nav-link", children: loginLabel }) : null;
  const signupNode = onSignup ? /* @__PURE__ */ jsx5("button", { type: "button", onClick: onSignup, className: "adh-header__nav-link adh-header__nav-link--button", children: signupLabel }) : signupHref ? /* @__PURE__ */ jsx5("a", { href: signupHref, className: "adh-header__nav-link", children: signupLabel }) : null;
  return /* @__PURE__ */ jsxs3(Fragment2, { children: [
    loginNode,
    signupNode
  ] });
}

// src/header/SiteOptionsMenu.tsx
import { Grid3x3 } from "lucide-react";

// src/components/ui/button.tsx
import * as React3 from "react";
import { Slot } from "@radix-ui/react-slot";
import { jsx as jsx6 } from "react/jsx-runtime";
function joinClasses3(...parts) {
  return parts.filter(Boolean).join(" ");
}
var Button = React3.forwardRef(
  ({ className, variant = "default", size = "default", asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return /* @__PURE__ */ jsx6(
      Comp,
      {
        className: joinClasses3(
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

// src/header/SiteOptionsMenu.tsx
import { jsx as jsx7, jsxs as jsxs4 } from "react/jsx-runtime";
function SiteOptionsMenu({
  sites,
  triggerLabel = "Sites",
  groupLabel = "Agentic Developer Hub"
}) {
  if (sites.length === 0) return null;
  return /* @__PURE__ */ jsxs4(DropdownMenu, { children: [
    /* @__PURE__ */ jsx7(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs4(Button, { variant: "ghost", size: "sm", "aria-label": triggerLabel, children: [
      /* @__PURE__ */ jsx7(Grid3x3, { className: "adh-button__icon" }),
      /* @__PURE__ */ jsx7("span", { children: triggerLabel })
    ] }) }),
    /* @__PURE__ */ jsxs4(DropdownMenuContent, { align: "end", children: [
      /* @__PURE__ */ jsx7(DropdownMenuLabel, { children: groupLabel }),
      /* @__PURE__ */ jsx7(DropdownMenuSeparator, {}),
      sites.map((site) => /* @__PURE__ */ jsx7(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsxs4("a", { href: site.href, children: [
        /* @__PURE__ */ jsx7("span", { children: site.label }),
        site.description && /* @__PURE__ */ jsx7("span", { className: "adh-dropdown-menu__shortcut", children: site.description })
      ] }) }, site.href))
    ] })
  ] });
}

// src/header/AdhHeader.tsx
import { jsx as jsx8, jsxs as jsxs5 } from "react/jsx-runtime";
function AdhHeader({
  siteName,
  siteNameHref = "/",
  pageTitle,
  navLinks = [],
  trailingNavLinks = [],
  sites,
  user,
  loginHref,
  signupHref,
  onLogin,
  onSignup,
  onLogout,
  settingsHref,
  onSettings
}) {
  const barLinks = user ? [] : navLinks.filter((l) => l.href !== siteNameHref);
  return /* @__PURE__ */ jsx8("header", { className: "adh-header", role: "banner", children: /* @__PURE__ */ jsxs5("div", { className: "adh-header__container", children: [
    /* @__PURE__ */ jsx8(Link3, { href: siteNameHref, className: "adh-header__title", children: siteName }),
    pageTitle && /* @__PURE__ */ jsx8("span", { className: "adh-header__page-title", children: pageTitle }),
    /* @__PURE__ */ jsxs5("nav", { className: "adh-header__nav", "aria-label": "Primary", children: [
      barLinks.map((link) => /* @__PURE__ */ jsx8(NavLinkItem, { link }, link.href + link.label)),
      sites && sites.length > 0 && /* @__PURE__ */ jsx8(SiteOptionsMenu, { sites }),
      user ? /* @__PURE__ */ jsx8(
        AvatarMenu,
        {
          user,
          navLinks,
          onLogout,
          settingsHref,
          onSettings
        }
      ) : /* @__PURE__ */ jsx8(
        AuthButtons,
        {
          loginHref,
          signupHref,
          onLogin,
          onSignup
        }
      ),
      trailingNavLinks.map((link) => /* @__PURE__ */ jsx8(NavLinkItem, { link }, link.href + link.label))
    ] })
  ] }) });
}
export {
  AdhHeader,
  AuthButtons,
  AvatarMenu,
  NavLinkItem,
  SiteOptionsMenu
};
//# sourceMappingURL=index.js.map