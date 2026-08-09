'use client'

"use client";

// src/header/AdhHeader.tsx
import "react";

// src/header/AvatarMenu.tsx
import Link from "next/link";
import { ChevronDown, Home, LogOut, Settings, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@agentic-toolkit/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator
} from "@agentic-toolkit/ui/components/dropdown-menu";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function firstNameOf(name) {
  return name.trim().split(/\s+/)[0] || name;
}
function initialsOf(name) {
  if (!name) return "";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}
function AvatarMenu({
  user,
  homeHref = "/",
  onLogout,
  settingsHref,
  onSettings
}) {
  const avatarInner = /* @__PURE__ */ jsxs(Avatar, { className: "adh-avatar-menu-trigger__avatar", children: [
    user.imageUrl && /* @__PURE__ */ jsx(AvatarImage, { src: user.imageUrl, alt: user.name }),
    /* @__PURE__ */ jsx(AvatarFallback, { children: initialsOf(user.name) || /* @__PURE__ */ jsx(UserIcon, { className: "adh-avatar-menu-trigger__fallback-icon" }) })
  ] });
  const settingsBody = /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Settings, { className: "adh-avatar-menu__item-icon" }),
    /* @__PURE__ */ jsx("span", { className: "adh-avatar-menu__item-label", children: "Settings" })
  ] });
  const settingsItem = settingsHref ? /* @__PURE__ */ jsx(DropdownMenuLinkItem, { render: /* @__PURE__ */ jsx(Link, { href: settingsHref }), className: "adh-avatar-menu__item", children: settingsBody }) : onSettings ? /* @__PURE__ */ jsx(DropdownMenuItem, { onClick: onSettings, className: "adh-avatar-menu__item", children: settingsBody }) : null;
  return /* @__PURE__ */ jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsxs(
      DropdownMenuTrigger,
      {
        className: "adh-avatar-menu-trigger",
        "aria-label": `Open ${user.name} menu`,
        children: [
          /* @__PURE__ */ jsx("span", { className: "adh-avatar-menu-trigger__avatar-wrap", children: avatarInner }),
          /* @__PURE__ */ jsx("span", { className: "adh-avatar-menu-trigger__chevron", "aria-hidden": "true", children: /* @__PURE__ */ jsx(ChevronDown, { className: "adh-avatar-menu-trigger__chevron-icon" }) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(DropdownMenuContent, { className: "adh-avatar-menu", align: "end", sideOffset: 8, children: [
      /* @__PURE__ */ jsx("div", { className: "adh-avatar-menu__header", children: /* @__PURE__ */ jsx("div", { className: "adh-avatar-menu__identity", children: /* @__PURE__ */ jsx("span", { className: "adh-avatar-menu__name", children: user.fullName ? `Welcome ${firstNameOf(user.fullName)}!` : user.name }) }) }),
      /* @__PURE__ */ jsx(DropdownMenuSeparator, {}),
      /* @__PURE__ */ jsxs(DropdownMenuLinkItem, { render: /* @__PURE__ */ jsx(Link, { href: homeHref }), className: "adh-avatar-menu__item", children: [
        /* @__PURE__ */ jsx(Home, { className: "adh-avatar-menu__item-icon" }),
        /* @__PURE__ */ jsx("span", { className: "adh-avatar-menu__item-label", children: "Home" })
      ] }),
      settingsItem && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(DropdownMenuSeparator, {}),
        settingsItem
      ] }),
      onLogout && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(DropdownMenuSeparator, {}),
        /* @__PURE__ */ jsxs(
          DropdownMenuItem,
          {
            onClick: onLogout,
            className: "adh-avatar-menu__item",
            children: [
              /* @__PURE__ */ jsx(LogOut, { className: "adh-avatar-menu__item-icon" }),
              /* @__PURE__ */ jsx("span", { className: "adh-avatar-menu__item-label", children: "Log out" })
            ]
          }
        )
      ] })
    ] })
  ] });
}

// src/header/AuthButtons.tsx
import { Fragment as Fragment2, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function AuthButtons({
  onSignup,
  onLogin,
  signupHref,
  loginHref,
  signupLabel = "join",
  loginLabel = "login"
}) {
  const loginNode = onLogin ? (
    // adh-ui-allow: cs-no-bespoke — this is the <a> two lines down in button clothing: same affordance, same .adh-header__nav-link identity, chosen only by whether a handler or an href was passed. A @agentic-toolkit/ui <Button> brings its own visual identity, which is exactly what must NOT happen to a nav link.
    /* @__PURE__ */ jsx2("button", { type: "button", onClick: onLogin, className: "adh-header__nav-link adh-header__nav-link--button", children: loginLabel })
  ) : loginHref ? /* @__PURE__ */ jsx2("a", { href: loginHref, className: "adh-header__nav-link", children: loginLabel }) : null;
  const signupNode = onSignup ? (
    // adh-ui-allow: cs-no-bespoke — same as loginNode above: the handler variant of a nav link, not a button. Keep the two branches visually identical.
    /* @__PURE__ */ jsx2("button", { type: "button", onClick: onSignup, className: "adh-header__nav-link adh-header__nav-link--button", children: signupLabel })
  ) : signupHref ? /* @__PURE__ */ jsx2("a", { href: signupHref, className: "adh-header__nav-link", children: signupLabel }) : null;
  return /* @__PURE__ */ jsxs2(Fragment2, { children: [
    loginNode,
    signupNode
  ] });
}

// src/header/SiteSwitcher.tsx
import Link3 from "next/link";
import "react";

// src/header/NavigationPopover.tsx
import {
  Fragment as Fragment3,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { ChevronDown as ChevronDown2 } from "lucide-react";

// src/header/NavLink.tsx
import Link2 from "next/link";
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
    Link2,
    {
      href: link.href,
      "aria-current": active ? "page" : void 0,
      className: "adh-header__nav-link",
      "data-active": active ? "" : void 0,
      children: link.label
    }
  );
}

// src/header/NavigationPopover.tsx
import { cn } from "@agentic-toolkit/ui";
import { confirmNavigation, GUARDED_NAV_ATTR } from "@agentic-toolkit/ui/lib/navigation-guard";
import {
  DropdownMenu as DropdownMenu2,
  DropdownMenuTrigger as DropdownMenuTrigger2,
  DropdownMenuContent as DropdownMenuContent2,
  DropdownMenuSeparator as DropdownMenuSeparator2,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@agentic-toolkit/ui/components/dropdown-menu";
import { Fragment as Fragment4, jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var GUARDED_NAV_PROPS = { [GUARDED_NAV_ATTR]: "" };
function highlightMatch(text, query) {
  const needle = query.trim();
  if (!needle) return text;
  const lower = text.toLowerCase();
  const ln = needle.toLowerCase();
  const out = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const at = lower.indexOf(ln, i);
    if (at === -1) {
      out.push(text.slice(i));
      break;
    }
    if (at > i) out.push(text.slice(i, at));
    out.push(
      /* @__PURE__ */ jsx4("span", { className: "adh-nav-popover__hl", children: text.slice(at, at + needle.length) }, key++)
    );
    i = at + needle.length;
  }
  return out;
}
function IconSlot({ icon: Icon }) {
  if (!Icon) return null;
  return /* @__PURE__ */ jsx4(Icon, { className: "adh-dropdown-menu__item-icon adh-nav-popover__icon", "aria-hidden": true });
}
function isModifiedClick(event) {
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
function NavigationPopover({
  entries,
  triggerLabel,
  triggerContent,
  triggerText,
  triggerIcon,
  triggerClassName,
  placeholder = "Search, or browse topics",
  emptyLabel = "No matches",
  onChoose,
  commandTrailing,
  searchCommand
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [nav, setNav] = useState({ kind: "none" });
  const [searchIndex, setSearchIndex] = useState(0);
  const inputRef = useRef(null);
  const uid = useId();
  const navByKeyboard = useRef(false);
  const suppressFocusRestore = useRef(false);
  const close = useCallback((opts) => {
    if (opts?.restoreFocus === false) suppressFocusRestore.current = true;
    setOpen(false);
  }, []);
  const chooseItem = useCallback(
    (item) => {
      setOpen(false);
      if (item.onSelect) {
        item.onSelect();
        return;
      }
      if (onChoose) {
        onChoose(item);
        return;
      }
      if (item.href && item.href !== "#") {
        const href = item.href;
        void confirmNavigation().then((ok) => {
          if (ok) window.location.assign(href);
        });
      }
    },
    [onChoose]
  );
  const searchTargets = useMemo(() => {
    const out = [];
    for (const e of entries) {
      if (e.kind === "topic") {
        for (const item of e.items) out.push({ item, area: e.label });
      } else {
        out.push({ item: e.item, area: null });
      }
    }
    return out;
  }, [entries]);
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return searchTargets.filter(
      (t) => t.item.label.toLowerCase().includes(needle) || (t.item.description?.toLowerCase().includes(needle) ?? false)
    );
  }, [searchTargets, query]);
  const trimmed = query.trim();
  const searching = trimmed.length > 0;
  const cmdActive = searching && (searchCommand?.matches(trimmed) ?? false);
  const searchActive = searchResults.length === 0 ? -1 : Math.min(searchIndex, searchResults.length - 1);
  const selectCommand = useCallback(() => {
    if (!searchCommand) return;
    close({ restoreFocus: false });
    searchCommand.onSelect();
  }, [close, searchCommand]);
  const disclosed = nav.kind === "sub" ? nav.entry : nav.kind === "top" && nav.open ? nav.entry : null;
  const activeKey = searching ? cmdActive ? "cmd" : searchActive >= 0 ? `s${searchActive}` : null : nav.kind === "sub" ? `e${nav.entry}s${nav.item}` : nav.kind === "top" ? `e${nav.entry}` : null;
  const activeId = activeKey ? `${uid}-${activeKey}` : void 0;
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement !== inputRef.current) inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, nav, searching]);
  useEffect(() => {
    if (!navByKeyboard.current || !activeKey) return;
    document.getElementById(`${uid}-${activeKey}`)?.scrollIntoView({ block: "nearest" });
  }, [uid, activeKey, query]);
  function moveSel(dir) {
    navByKeyboard.current = true;
    if (nav.kind === "sub") {
      const entry = entries[nav.entry];
      if (entry?.kind === "topic") {
        const next = nav.item + dir;
        if (next >= 0 && next < entry.items.length) {
          setNav({ kind: "sub", entry: nav.entry, item: next });
          return;
        }
        const siblingIdx = nav.entry + dir;
        const sibling = entries[siblingIdx];
        if (sibling?.kind === "topic") {
          setNav({ kind: "sub", entry: siblingIdx, item: dir > 0 ? 0 : sibling.items.length - 1 });
        }
        return;
      }
    }
    const n = entries.length;
    if (!n) return;
    const cur = nav.kind === "none" ? null : nav.entry;
    const nextEntry = cur === null ? dir > 0 ? 0 : n - 1 : (cur + dir + n) % n;
    setNav({ kind: "top", entry: nextEntry, open: false });
  }
  function discloseRight() {
    if (nav.kind !== "top") return;
    if (entries[nav.entry]?.kind !== "topic") return;
    navByKeyboard.current = true;
    setNav({ kind: "sub", entry: nav.entry, item: 0 });
  }
  function collapseLeft() {
    navByKeyboard.current = true;
    if (nav.kind === "sub" || nav.kind === "top" && nav.open) {
      setNav({ kind: "top", entry: nav.entry, open: false });
    }
  }
  function choose() {
    if (searching) {
      if (cmdActive) {
        selectCommand();
        return;
      }
      const target = searchResults[searchActive]?.item;
      if (!target) return;
      chooseItem(target);
      return;
    }
    if (nav.kind === "none") return;
    const entry = entries[nav.entry];
    if (!entry) return;
    if (nav.kind === "top") {
      if (entry.kind === "topic") {
        discloseRight();
        return;
      }
      chooseItem(entry.item);
      return;
    }
    if (entry.kind === "topic") {
      const item = entry.items[nav.item];
      if (item) chooseItem(item);
    }
  }
  function handleOpenChange(next) {
    setOpen(next);
    if (next) {
      setQuery("");
      setNav({ kind: "none" });
      setSearchIndex(0);
    }
  }
  function handleInputKeyDown(event) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        event.stopPropagation();
        navByKeyboard.current = true;
        if (searching) setSearchIndex(Math.min(searchActive + 1, searchResults.length - 1));
        else moveSel(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        event.stopPropagation();
        navByKeyboard.current = true;
        if (searching) setSearchIndex(Math.max(searchActive - 1, 0));
        else moveSel(-1);
        break;
      case "ArrowRight":
        if (!searching) {
          event.preventDefault();
          event.stopPropagation();
          discloseRight();
        } else {
          event.stopPropagation();
        }
        break;
      case "ArrowLeft":
        if (!searching) {
          event.preventDefault();
          event.stopPropagation();
          collapseLeft();
        } else {
          event.stopPropagation();
        }
        break;
      case "Enter":
        event.preventDefault();
        event.stopPropagation();
        choose();
        break;
      case "Tab":
        event.preventDefault();
        event.stopPropagation();
        break;
      case "Escape":
        break;
      default:
        event.stopPropagation();
    }
  }
  function renderItem(item, entryIndex, j) {
    const isActive = nav.kind === "sub" && nav.entry === entryIndex && nav.item === j;
    return /* @__PURE__ */ jsxs3(
      "a",
      {
        id: `${uid}-e${entryIndex}s${j}`,
        "data-nav": `e${entryIndex}s${j}`,
        role: "menuitem",
        "aria-current": item.current ? "page" : void 0,
        href: item.href,
        ...GUARDED_NAV_PROPS,
        className: cn("adh-dropdown-menu__item", {
          "adh-nav-popover__item--active": isActive,
          "adh-nav-popover__item--current": item.current
        }),
        onMouseDown: (event) => event.preventDefault(),
        onMouseMove: () => {
          navByKeyboard.current = false;
          setNav({ kind: "sub", entry: entryIndex, item: j });
        },
        onClick: (event) => {
          if (isModifiedClick(event)) return;
          event.preventDefault();
          chooseItem(item);
        },
        children: [
          /* @__PURE__ */ jsx4(IconSlot, { icon: item.icon }),
          /* @__PURE__ */ jsx4("span", { className: "adh-nav-popover__link-name", children: item.label }),
          item.description && /* @__PURE__ */ jsx4("span", { className: "adh-dropdown-menu__shortcut", children: item.description })
        ]
      },
      `${item.key}-${entryIndex}-${j}`
    );
  }
  return (
    // Controlled so `close()` actually closes the menu — trailing controls and
    // the search command both close it programmatically before handing off.
    /* @__PURE__ */ jsxs3(DropdownMenu2, { open, onOpenChange: handleOpenChange, children: [
      /* @__PURE__ */ jsx4(
        DropdownMenuTrigger2,
        {
          className: cn("adh-header__title adh-nav-popover__trigger", triggerClassName),
          "aria-label": triggerLabel,
          children: triggerContent ?? /* @__PURE__ */ jsxs3(Fragment4, { children: [
            triggerIcon,
            /* @__PURE__ */ jsx4("span", { children: triggerText ?? triggerLabel }),
            /* @__PURE__ */ jsx4(ChevronDown2, { className: "adh-nav-popover__chevron", "aria-hidden": true })
          ] })
        }
      ),
      /* @__PURE__ */ jsxs3(
        DropdownMenuContent2,
        {
          align: "start",
          className: "adh-nav-popover__menu",
          onMouseLeave: (event) => {
            const to = event.relatedTarget;
            if (to instanceof Element && to.closest('[role="menu"]')) return;
            setNav(
              (cur) => cur.kind === "top" && cur.open ? { kind: "top", entry: cur.entry, open: false } : cur
            );
          },
          finalFocus: () => {
            if (suppressFocusRestore.current) {
              suppressFocusRestore.current = false;
              return false;
            }
            return true;
          },
          children: [
            /* @__PURE__ */ jsxs3("div", { className: "adh-nav-popover__search", children: [
              /* @__PURE__ */ jsx4("span", { className: "adh-nav-popover__prompt", "aria-hidden": true, children: ">" }),
              /* @__PURE__ */ jsx4(
                "input",
                {
                  ref: inputRef,
                  type: "text",
                  className: "adh-nav-popover__search-input",
                  placeholder,
                  "aria-label": placeholder,
                  role: "combobox",
                  "aria-expanded": true,
                  "aria-controls": `${uid}-list`,
                  "aria-activedescendant": activeId,
                  autoComplete: "off",
                  spellCheck: false,
                  value: query,
                  onChange: (event) => {
                    navByKeyboard.current = true;
                    setQuery(event.target.value);
                    setSearchIndex(0);
                    setNav({ kind: "none" });
                  },
                  onKeyDown: handleInputKeyDown
                }
              ),
              commandTrailing?.({ close })
            ] }),
            /* @__PURE__ */ jsx4(DropdownMenuSeparator2, {}),
            /* @__PURE__ */ jsxs3("div", { id: `${uid}-list`, className: "adh-nav-popover__list", children: [
              !searching && entries.map((entry, index) => {
                const prev = entries[index - 1];
                const divider = prev !== void 0 && prev.section !== entry.section;
                const sep = divider ? /* @__PURE__ */ jsx4("div", { className: "adh-dropdown-menu__separator", role: "separator" }) : null;
                if (entry.kind === "topic") {
                  return /* @__PURE__ */ jsxs3(Fragment3, { children: [
                    sep,
                    /* @__PURE__ */ jsxs3(
                      DropdownMenuSub,
                      {
                        open: index === disclosed,
                        onOpenChange: (next) => {
                          if (next) {
                            navByKeyboard.current = false;
                            setNav({ kind: "top", entry: index, open: true });
                          }
                        },
                        children: [
                          /* @__PURE__ */ jsxs3(
                            DropdownMenuSubTrigger,
                            {
                              "data-nav": `e${index}`,
                              className: cn("adh-nav-popover__topic", {
                                "adh-nav-popover__item--active": nav.kind === "top" && nav.entry === index,
                                "adh-nav-popover__item--indent": entry.indent
                              }),
                              onMouseDown: (event) => event.preventDefault(),
                              onMouseMove: () => {
                                navByKeyboard.current = false;
                                setNav({ kind: "top", entry: index, open: true });
                              },
                              children: [
                                /* @__PURE__ */ jsx4(IconSlot, { icon: entry.icon }),
                                /* @__PURE__ */ jsx4("span", { id: `${uid}-e${index}`, children: entry.label })
                              ]
                            }
                          ),
                          /* @__PURE__ */ jsx4(DropdownMenuSubContent, { className: "adh-nav-popover__submenu", children: entry.items.map((item, j) => renderItem(item, index, j)) })
                        ]
                      }
                    )
                  ] }, `topic-${index}`);
                }
                const isActive = nav.kind === "top" && nav.entry === index;
                return /* @__PURE__ */ jsxs3(Fragment3, { children: [
                  sep,
                  /* @__PURE__ */ jsxs3(
                    "a",
                    {
                      id: `${uid}-e${index}`,
                      "data-nav": `e${index}`,
                      role: "menuitem",
                      "aria-current": entry.item.current ? "page" : void 0,
                      href: entry.item.href,
                      ...GUARDED_NAV_PROPS,
                      className: cn("adh-dropdown-menu__item", {
                        "adh-nav-popover__item--active": isActive,
                        "adh-nav-popover__item--current": entry.item.current,
                        "adh-nav-popover__item--indent": entry.indent
                      }),
                      onMouseDown: (event) => event.preventDefault(),
                      onMouseMove: () => {
                        navByKeyboard.current = false;
                        setNav({ kind: "top", entry: index, open: false });
                      },
                      onClick: (event) => {
                        if (isModifiedClick(event)) return;
                        event.preventDefault();
                        chooseItem(entry.item);
                      },
                      children: [
                        /* @__PURE__ */ jsx4(IconSlot, { icon: entry.item.icon }),
                        /* @__PURE__ */ jsx4("span", { className: "adh-nav-popover__link-name", children: entry.item.label }),
                        entry.blurb && entry.item.description && /* @__PURE__ */ jsx4("span", { className: "adh-dropdown-menu__shortcut", children: entry.item.description })
                      ]
                    }
                  )
                ] }, `leaf-${entry.item.key}`);
              }),
              searching && cmdActive && searchCommand && /* @__PURE__ */ jsxs3(
                "button",
                {
                  type: "button",
                  id: `${uid}-cmd`,
                  role: "menuitem",
                  className: "adh-dropdown-menu__item adh-nav-popover__item--active adh-nav-popover__help-row",
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: selectCommand,
                  children: [
                    /* @__PURE__ */ jsx4("span", { children: searchCommand.label }),
                    searchCommand.shortcut && /* @__PURE__ */ jsx4("span", { className: "adh-dropdown-menu__shortcut", children: searchCommand.shortcut })
                  ]
                }
              ),
              searching && !cmdActive && searchResults.map((result, index) => {
                const { item, area } = result;
                const isActive = index === searchActive;
                return /* @__PURE__ */ jsxs3(
                  "a",
                  {
                    id: `${uid}-s${index}`,
                    "data-search": index,
                    role: "menuitem",
                    "aria-current": item.current ? "page" : void 0,
                    href: item.href,
                    ...GUARDED_NAV_PROPS,
                    className: cn("adh-dropdown-menu__item adh-nav-popover__match", {
                      "adh-nav-popover__item--active": isActive,
                      "adh-nav-popover__item--current": item.current
                    }),
                    onMouseDown: (event) => event.preventDefault(),
                    onMouseMove: () => {
                      navByKeyboard.current = false;
                      setSearchIndex(index);
                    },
                    onClick: (event) => {
                      if (isModifiedClick(event)) return;
                      event.preventDefault();
                      chooseItem(item);
                    },
                    children: [
                      /* @__PURE__ */ jsx4(IconSlot, { icon: item.icon }),
                      area && /* @__PURE__ */ jsxs3(Fragment4, { children: [
                        /* @__PURE__ */ jsx4("span", { className: "adh-nav-popover__area", children: area }),
                        /* @__PURE__ */ jsx4("span", { className: "adh-nav-popover__arrow", "aria-hidden": true, children: "\u2192" })
                      ] }),
                      /* @__PURE__ */ jsx4("span", { className: "adh-nav-popover__link-name", children: highlightMatch(item.label, query) }),
                      item.description && /* @__PURE__ */ jsx4("span", { className: "adh-dropdown-menu__shortcut", children: highlightMatch(item.description, query) })
                    ]
                  },
                  `${item.key}-${index}`
                );
              })
            ] }),
            searching && !cmdActive && searchResults.length === 0 && /* @__PURE__ */ jsx4("p", { className: "adh-nav-popover__empty", role: "status", "aria-live": "polite", children: emptyLabel })
          ]
        }
      )
    ] })
  );
}

// src/header/SiteOptionsMenu.tsx
import { Grid3x3 } from "lucide-react";

// src/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { jsx as jsx5 } from "react/jsx-runtime";
function joinClasses(...parts) {
  return parts.filter(Boolean).join(" ");
}
var Button = React.forwardRef(
  ({ className, variant = "default", size = "default", asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return /* @__PURE__ */ jsx5(
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

// src/header/SiteOptionsMenu.tsx
import {
  DropdownMenu as DropdownMenu3,
  DropdownMenuTrigger as DropdownMenuTrigger3,
  DropdownMenuContent as DropdownMenuContent3,
  DropdownMenuLinkItem as DropdownMenuLinkItem2,
  DropdownMenuLabel,
  DropdownMenuSeparator as DropdownMenuSeparator3
} from "@agentic-toolkit/ui/components/dropdown-menu";
import { jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
function SiteOptionsMenu({
  sites,
  triggerLabel = "Sites",
  groupLabel = "Sites"
}) {
  if (sites.length === 0) return null;
  return /* @__PURE__ */ jsxs4(DropdownMenu3, { children: [
    /* @__PURE__ */ jsxs4(
      DropdownMenuTrigger3,
      {
        render: /* @__PURE__ */ jsx6(Button, { variant: "ghost", size: "sm", "aria-label": triggerLabel }),
        children: [
          /* @__PURE__ */ jsx6(Grid3x3, { className: "adh-button__icon" }),
          /* @__PURE__ */ jsx6("span", { children: triggerLabel })
        ]
      }
    ),
    /* @__PURE__ */ jsxs4(DropdownMenuContent3, { align: "end", children: [
      /* @__PURE__ */ jsx6(DropdownMenuLabel, { children: groupLabel }),
      /* @__PURE__ */ jsx6(DropdownMenuSeparator3, {}),
      sites.map((site) => (
        // LinkItem, not Item-wrapping-an-anchor: these are cross-SITE hrefs, so the
        // browser's own link semantics (middle-click, open-in-new-tab, status bar)
        // are the point, and LinkItem is the engine's way of keeping them.
        /* @__PURE__ */ jsxs4(DropdownMenuLinkItem2, { render: /* @__PURE__ */ jsx6("a", { href: site.href }), children: [
          /* @__PURE__ */ jsx6("span", { children: site.label }),
          site.description && /* @__PURE__ */ jsx6("span", { className: "adh-dropdown-menu__shortcut", children: site.description })
        ] }, site.href)
      ))
    ] })
  ] });
}

// src/header/SiteSwitcher.tsx
import { jsx as jsx7 } from "react/jsx-runtime";
function SiteSwitcher({
  siteName,
  siteNameHref = "/",
  sites = [],
  onSwitchSite
}) {
  if (sites.length === 0) {
    return /* @__PURE__ */ jsx7(Link3, { href: siteNameHref, className: "adh-header__title", children: siteName });
  }
  const entries = sites.map((site) => ({
    kind: "leaf",
    section: 0,
    item: {
      //  `id` is optional on the published `SiteLink` (its owner, SiteOptionsMenu,
      //  never reads it), so fall back to the href — unique among switch targets by
      //  construction, and a stable key either way.
      key: site.id ?? site.href,
      label: site.label,
      description: site.description,
      href: site.href
    }
  }));
  return /* @__PURE__ */ jsx7(
    NavigationPopover,
    {
      entries,
      triggerLabel: `${siteName} \u2014 switch site`,
      triggerText: siteName,
      triggerClassName: "adh-header__title",
      onChoose: (item) => {
        const href = onSwitchSite?.(item.key) ?? item.href;
        if (href) window.location.assign(href);
      }
    }
  );
}

// src/header/PreviewNotice.tsx
import { useEffect as useEffect2, useId as useId2, useRef as useRef2, useState as useState2 } from "react";
import { ChevronDown as ChevronDown3, TriangleAlert } from "lucide-react";
import { jsx as jsx8, jsxs as jsxs5 } from "react/jsx-runtime";
var DEFAULT_PREVIEW_NOTICE = "Developer Preview Release";
var DEFAULT_PREVIEW_DETAIL = "We are in very early stages, and are only taking requests to join.";
function PreviewNotice({
  notice = DEFAULT_PREVIEW_NOTICE,
  detail = DEFAULT_PREVIEW_DETAIL
}) {
  const [open, setOpen] = useState2(false);
  const panelId = useId2();
  const triggerRef = useRef2(null);
  useEffect2(() => {
    if (!open) return;
    const onClick = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);
  return /* @__PURE__ */ jsx8("div", { className: "adh-header__preview", children: /* @__PURE__ */ jsxs5("span", { className: "adh-header__preview-disclosure", onMouseLeave: () => setOpen(false), children: [
    /* @__PURE__ */ jsxs5(
      "button",
      {
        ref: triggerRef,
        type: "button",
        className: "adh-header__preview-trigger",
        "aria-expanded": open,
        "aria-controls": open ? panelId : void 0,
        onClick: () => setOpen((v) => !v),
        children: [
          /* @__PURE__ */ jsx8(TriangleAlert, { className: "adh-header__preview-icon", "aria-hidden": true }),
          /* @__PURE__ */ jsx8("span", { className: "adh-header__preview-text", children: notice }),
          /* @__PURE__ */ jsx8(TriangleAlert, { className: "adh-header__preview-icon", "aria-hidden": true }),
          /* @__PURE__ */ jsx8(ChevronDown3, { className: "adh-header__preview-caret", "aria-hidden": true })
        ]
      }
    ),
    open && /* @__PURE__ */ jsx8("span", { className: "adh-header__preview-panel", id: panelId, children: detail })
  ] }) });
}

// src/header/AdhHeader.tsx
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { jsx as jsx9, jsxs as jsxs6 } from "react/jsx-runtime";
function AdhHeader({
  siteName,
  siteNameHref = "/",
  sites,
  onSwitchSite,
  siteSwitcher,
  pageTitle,
  center,
  badges = [],
  leadingActions,
  navLinks = [],
  trailingNavLinks = [],
  preAuthLinks,
  homeHref,
  previewNotice,
  previewDetail,
  user,
  authLoading = false,
  loginHref,
  signupHref,
  onLogin,
  onSignup,
  onLogout,
  settingsHref,
  onSettings
}) {
  const barLinks = siteSwitcher ? navLinks : navLinks.filter((l) => l.href !== siteNameHref);
  return /* @__PURE__ */ jsxs6("header", { className: "adh-header", role: "banner", children: [
    /* @__PURE__ */ jsx9(PreviewNotice, { notice: previewNotice, detail: previewDetail }),
    /* @__PURE__ */ jsxs6("div", { className: "adh-header__container", children: [
      /* @__PURE__ */ jsxs6("div", { className: "adh-header__lead", children: [
        siteSwitcher ?? /* @__PURE__ */ jsx9(
          SiteSwitcher,
          {
            siteName,
            siteNameHref,
            sites,
            onSwitchSite
          }
        ),
        badges.length > 0 && /* @__PURE__ */ jsx9("span", { className: "adh-header__badges", "aria-hidden": "true", children: badges.map((badge) => (
          // The ui Badge owns the skin; the adh-header__badge* classes stay
          // as stable hooks — they're a theme-editor surface.
          /* @__PURE__ */ jsx9(
            Badge,
            {
              variant: badge.tone ?? "neutral",
              className: badge.tone ? `adh-header__badge adh-header__badge--${badge.tone}` : "adh-header__badge",
              children: badge.label
            },
            badge.label
          )
        )) })
      ] }),
      center ? /* @__PURE__ */ jsx9("div", { className: "adh-header__center", children: center }) : pageTitle && /* @__PURE__ */ jsx9("span", { className: "adh-header__page-title", children: pageTitle }),
      /* @__PURE__ */ jsxs6("nav", { className: "adh-header__nav", "aria-label": "Primary", children: [
        leadingActions && /* @__PURE__ */ jsx9("span", { className: "adh-header__actions", children: leadingActions }),
        barLinks.length > 0 && /* @__PURE__ */ jsx9("span", { className: "adh-header__links", children: barLinks.map((link) => /* @__PURE__ */ jsx9(NavLinkItem, { link }, link.href + link.label)) }),
        preAuthLinks,
        authLoading && !user ? /* @__PURE__ */ jsx9(
          "span",
          {
            className: "adh-header__auth-spinner",
            role: "status",
            "aria-label": "Checking sign-in"
          }
        ) : user ? /* @__PURE__ */ jsx9(
          AvatarMenu,
          {
            user,
            homeHref,
            onLogout,
            settingsHref,
            onSettings
          }
        ) : /* @__PURE__ */ jsx9(
          AuthButtons,
          {
            loginHref,
            signupHref,
            onLogin,
            onSignup
          }
        ),
        trailingNavLinks.map((link) => /* @__PURE__ */ jsx9(NavLinkItem, { link }, link.href + link.label))
      ] })
    ] })
  ] });
}

// src/header/HubMark.tsx
import { jsx as jsx10, jsxs as jsxs7 } from "react/jsx-runtime";
function HubMark({ className }) {
  return /* @__PURE__ */ jsxs7(
    "svg",
    {
      viewBox: "0 0 1024 1024",
      className,
      fill: "currentColor",
      "aria-hidden": true,
      focusable: "false",
      children: [
        /* @__PURE__ */ jsx10("path", { d: "M816,58 Q816,208 966,208 Q816,208 816,358 Q816,208 666,208 Q816,208 816,58 Z" }),
        /* @__PURE__ */ jsx10("path", { d: "M816,666 Q816,816 966,816 Q816,816 816,966 Q816,816 666,816 Q816,816 816,666 Z" }),
        /* @__PURE__ */ jsx10("path", { d: "M208,666 Q208,816 358,816 Q208,816 208,966 Q208,816 58,816 Q208,816 208,666 Z" }),
        /* @__PURE__ */ jsx10("path", { d: "M208,58 Q208,208 358,208 Q208,208 208,358 Q208,208 58,208 Q208,208 208,58 Z" }),
        /* @__PURE__ */ jsx10("path", { d: "M512,72 Q512,512 952,512 Q512,512 512,952 Q512,512 72,512 Q512,512 512,72 Z" })
      ]
    }
  );
}

// src/header/routeEntries.ts
function isDynamicPath(path) {
  return path.includes("[");
}
function currentRoutePath(navigablePaths, pathname) {
  let best = null;
  for (const path of navigablePaths) {
    const matches = path === pathname || path !== "/" && pathname.startsWith(`${path}/`);
    if (matches && (best === null || path.length > best.length)) best = path;
  }
  return best;
}
function buildRouteItems(sections, pathname) {
  const routes = sections.flatMap((section) => section.routes);
  const current = currentRoutePath(
    routes.filter((route) => !isDynamicPath(route.path)).map((route) => route.path),
    pathname
  );
  return routes.slice().sort((a, b) => a.path.localeCompare(b.path)).map((route) => {
    const navigable = !isDynamicPath(route.path);
    return {
      key: route.path,
      label: route.path,
      description: route.description,
      href: navigable ? route.path : void 0,
      current: navigable && route.path === current
    };
  });
}

// src/header/useClientHost.ts
import { useEffect as useEffect3, useState as useState3 } from "react";
function useClientHost() {
  const [host, setHost] = useState3(null);
  useEffect3(() => setHost(window.location.host), []);
  return host;
}

// src/header/workspaces-menu.tsx
import { createContext, useContext } from "react";
import { jsx as jsx11 } from "react/jsx-runtime";
var WorkspacesMenuContext = createContext(null);
function WorkspacesMenuProvider({
  value,
  children
}) {
  return /* @__PURE__ */ jsx11(WorkspacesMenuContext.Provider, { value, children });
}
function useWorkspacesMenu() {
  return useContext(WorkspacesMenuContext);
}

// src/header/SiteHeader.tsx
import "react";
import {
  AdhHeader as AdhHeader2,
  useClientHost as useClientHost4
} from "@agentic-toolkit/adh/header";
import { useAnonymousHeaderAuth } from "@agentic-toolkit/adh/header-auth";
import { getSite as getSite3, siteHeaderTitle as siteHeaderTitle2, siteHomePath, siteProdUrl as siteProdUrl2, siteUrl as siteUrl2 } from "@agentic-toolkit/adh-registry";
import { isConceptSite as isConceptSite2 } from "@agentic-toolkit/adh/concepts/participating";

// src/header/SiteMenuSwitcher.tsx
import { Fragment as Fragment6 } from "react";
import { usePathname as usePathname4 } from "next/navigation";

// src/header/SiteMenu.tsx
import { useEffect as useEffect4, useMemo as useMemo3, useState as useState4 } from "react";
import { usePathname as usePathname3 } from "next/navigation";
import dynamic from "next/dynamic";
import { CircleHelp as CircleHelp2, Settings as Settings2 } from "lucide-react";

// src/footer/SitesOverview.tsx
import { FOOTER_SITES, groupSitesByCategory, siteProdUrl } from "@agentic-toolkit/adh-registry";
import { jsx as jsx12, jsxs as jsxs8 } from "react/jsx-runtime";
var SITES_OVERVIEW_POPOVER_ID = "adh-sites-overview";

// src/header/SiteMenu.tsx
import { detectEnv as detectEnv3, getSite as getSite2, siteHeaderTitle } from "@agentic-toolkit/adh-registry";
import {
  HubMark as HubMark2,
  NavigationPopover as NavigationPopover2,
  useClientHost as useClientHost3,
  useWorkspacesMenu as useWorkspacesMenu2
} from "@agentic-toolkit/adh/header";
import { useRecents } from "@agentic-toolkit/adh/header/recents";

// src/header/useSiteMenu.ts
import { useCallback as useCallback2, useMemo as useMemo2 } from "react";
import { usePathname as usePathname2, useRouter } from "next/navigation";
import { confirmNavigation as confirmNavigation2 } from "@agentic-toolkit/ui/lib/navigation-guard";
import {
  buildSiteHref,
  detectEnv,
  getSite,
  hubSwitchHref,
  HUB_WORKSPACE_SEGMENTS,
  siteUrl
} from "@agentic-toolkit/adh-registry";
import { hubWorkspaceSlug, isHubWorkspacePath } from "@agentic-toolkit/adh/site/hubWorkspacePath";
import { appendThemePreview, readPreviewTheme } from "@agentic-toolkit/adh/themes/theme-preview";
import {
  useClientHost as useClientHost2
} from "@agentic-toolkit/adh/header";

// src/header/menu-icons.ts
import {
  Activity,
  BadgeCheck,
  Bell,
  BookOpen,
  BookText,
  BookUser,
  Bot,
  Boxes,
  Briefcase,
  Bug,
  Building,
  ChefHat,
  CircleHelp,
  Code,
  Contact,
  CreditCard,
  Fingerprint,
  FlaskConical,
  FolderKanban,
  GitPullRequest,
  Globe,
  GraduationCap,
  Hammer,
  Handshake,
  HardDrive,
  Hexagon,
  History,
  House,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Library,
  LifeBuoy,
  LogIn,
  Mail,
  MonitorSmartphone,
  Network,
  Newspaper,
  NotebookText,
  Package,
  Route,
  School,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserCircle,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
  Wrench
} from "lucide-react";
var MENU_ICONS = {
  // --- Hub + its ecosystem sites (inline sub-items under Hub) ---
  hub: Hexagon,
  bitbag: Bot,
  // the hub's AI persona
  community: Users,
  // matches FEATURE_META `communities`
  personaregistry: UserCircle,
  // matches FEATURE_META `personas`
  toolkit: Wrench,
  // matches the myagenticteams landing's toolkit glyph
  cookbook: ChefHat,
  // recipes/cookbook
  devteam: UsersRound,
  // matches FEATURE_META `teams`
  myagenticteams: Sparkles,
  // matches the myagenticteams landing
  narratives: ScrollText,
  // matches FEATURE_META `narratives`
  help: CircleHelp,
  // matches SiteMenu's existing help affordance
  "hub-help": CircleHelp,
  // the promoted family Help site (help.adh.com)
  news: Newspaper,
  // --- Destination rows keyed by route path ---
  // The two that moved out of hub's header bar keep the glyph they wore there, so a
  // visitor who knew them in the bar recognizes them in the menu. '/details' is
  // resolved per-SITE rather than on the hub (see SiteMenu) — the key is still the
  // route, because that is what the row points at on whichever site renders it.
  "/contact": Mail,
  "/details": LayoutGrid,
  "/products": Network,
  // matches FEATURE_META `products` (Products replaced /ecosystems)
  "/personas": UserCircle,
  // matches FEATURE_META `personas`
  "/organizations": Building,
  // matches WorkspaceShell's organization type icon
  "/research": FlaskConical,
  // matches FEATURE_META `research`
  // --- Chrome rows (the auth-conditional top section, + the dev-only tools
  //     appended after the Marketing/Main sites submenus) ---
  home: House,
  workspaces: Boxes,
  recents: History,
  login: LogIn,
  signup: UserPlus,
  routes: Route,
  debug: Bug,
  // --- Remaining MAIN family sites (websites/main/), for the dev "Main sites"
  //     submenu. The rest of the family (hub, bitbag, community, cookbook,
  //     devteam, help, myagenticteams, news, personaregistry, toolkit) is mapped
  //     among the Hub-core rows above. ---
  admin: ShieldCheck,
  // operations console
  api: Code,
  docs: BookText,
  // guides & API reference
  learntruefacts: BadgeCheck,
  // "true facts"
  status: Activity,
  // system status / pulse
  support: LifeBuoy,
  // --- MARKETING family sites (websites/marketing/), for the dev "Marketing
  //     sites" submenu. Where a site mirrors a hub feature, it reuses the
  //     FEATURE_META glyph so the menu matches the workspace rail. ('narratives'
  //     is mapped among the Hub-core rows above.) ---
  academy: GraduationCap,
  authentication: Fingerprint,
  // customer auth / identity
  billing: CreditCard,
  // matches FEATURE_META `billing`
  codereviews: GitPullRequest,
  communities: Users,
  // matches FEATURE_META `communities`
  consultants: Briefcase,
  consulting: Handshake,
  // services CTA
  customers: Contact,
  dashboards: LayoutDashboard,
  // matches FEATURE_META `dashboards`
  devices: MonitorSmartphone,
  domains: Globe,
  ecosystems: Network,
  // matches FEATURE_META `ecosystems` (+ the '/ecosystems' route)
  education: School,
  knowledgebases: BookOpen,
  // matches FEATURE_META `knowledgebases`
  notifications: Bell,
  personabuilder: UserCog,
  // configure personas
  personas: UserCircle,
  // matches FEATURE_META `personas` (+ the '/personas' route)
  products: Package,
  projects: FolderKanban,
  // matches FEATURE_META `projects`
  recipes: NotebookText,
  registries: Library,
  research: FlaskConical,
  // matches FEATURE_META `research` (+ the '/research' route)
  sites: LayoutTemplate,
  // quick landing pages
  storage: HardDrive,
  teambuilder: UsersRound,
  // matches FEATURE_META `teams`
  teamregistry: BookUser,
  // a directory of teams
  tools: Hammer
};
function menuIcon(key) {
  return key ? MENU_ICONS[key] : void 0;
}

// src/header/useSiteMenu.ts
function useSiteMenu(groups, { currentSiteId, resolveHref, personalSlug }) {
  const pathname = usePathname2() ?? "/";
  const router = useRouter();
  const workspaceSlug = currentSiteId === "hub" && isHubWorkspacePath(pathname) ? hubWorkspaceSlug(pathname) ?? personalSlug ?? null : null;
  const hostname = useClientHost2();
  const currentEnv = useMemo2(() => hostname ? detectEnv(hostname) : null, [hostname]);
  const previewTheme = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "local" || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "testing" || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "staging" ? readPreviewTheme() : null;
  const carryTheme = useCallback2(
    (href) => process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "local" || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "testing" || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "staging" ? appendThemePreview(href, previewTheme) : href,
    [previewTheme]
  );
  const hrefFor = useCallback2(
    (site, external) => {
      if (workspaceSlug && !external) {
        if (site.id === "hub") return `/${workspaceSlug}/home`;
        const hubRoute = hubSwitchHref(workspaceSlug, site);
        if (hubRoute) return hubRoute;
      }
      if (site.id === currentSiteId) return "/";
      if (!hostname) return "#";
      const carriedPath = external ? "/" : pathname;
      const href = carryTheme(buildSiteHref(site, hostname, carriedPath));
      if (!resolveHref) return href;
      try {
        return detectEnv(new URL(href).hostname) === currentEnv ? resolveHref(href) : href;
      } catch {
        return href;
      }
    },
    [workspaceSlug, hostname, currentSiteId, pathname, resolveHref, currentEnv, carryTheme]
  );
  const routeHref = useCallback2(
    (route) => {
      if (currentSiteId === "hub") {
        const seg = route.split("/").filter(Boolean)[0];
        const slug = workspaceSlug ?? personalSlug;
        return slug && seg != null && HUB_WORKSPACE_SEGMENTS.has(seg) ? `/${slug}${route}` : route;
      }
      if (!hostname) return "#";
      const href = carryTheme(siteUrl("hub", route, hostname));
      if (!resolveHref) return href;
      try {
        return detectEnv(new URL(href).hostname) === currentEnv ? resolveHref(href) : href;
      } catch {
        return href;
      }
    },
    [currentSiteId, workspaceSlug, personalSlug, hostname, resolveHref, currentEnv, carryTheme]
  );
  const entries = useMemo2(() => {
    const path = pathname || "/";
    const toItem = (link) => {
      if ("route" in link) {
        const href = routeHref(link.route);
        return {
          key: `route:${link.route}`,
          label: link.label,
          description: link.description,
          href,
          icon: menuIcon(link.route),
          current: href.startsWith("/") && !href.startsWith("//") && (path === href || path.startsWith(`${href}/`))
        };
      }
      const site = getSite(link.site);
      if (!site) return null;
      return {
        key: site.id,
        label: link.label ?? site.label,
        description: link.description ?? site.description,
        href: hrefFor(site, link.external),
        icon: menuIcon(site.id),
        current: site.id === currentSiteId
      };
    };
    const out = [];
    for (const g of groups) {
      if (g.kind === "topic") {
        const items = g.links.map(toItem).filter((r) => r !== null);
        if (items.length) out.push({ kind: "topic", section: g.section, label: g.label, items });
      } else {
        const item = toItem(g.link);
        if (item)
          out.push({
            kind: "leaf",
            section: g.section,
            blurb: g.blurb ?? false,
            indent: g.kind === "inline",
            item
          });
      }
    }
    return out;
  }, [groups, pathname, routeHref, hrefFor, currentSiteId]);
  const navigate = useCallback2(
    (item) => {
      const href = item.href;
      if (!href || href === "#") return;
      void confirmNavigation2().then((ok) => {
        if (!ok) return;
        if (href.startsWith("/") && !href.startsWith("//")) {
          router.push(href);
          return;
        }
        window.location.assign(href);
      });
    },
    [router]
  );
  const homeHref = routeHref("/home");
  return { entries, navigate, homeHref, routeHref };
}

// src/header/useHeaderLinksCollapsed.ts
import { useCallback as useCallback3, useSyncExternalStore } from "react";
var HEADER_LINKS_COLLAPSE_QUERY = "(max-width: 768px)";
function useHeaderLinksCollapsed() {
  const subscribe2 = useCallback3((onChange) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {
    };
    const mq = window.matchMedia(HEADER_LINKS_COLLAPSE_QUERY);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return useSyncExternalStore(
    subscribe2,
    () => typeof window !== "undefined" && !!window.matchMedia ? window.matchMedia(HEADER_LINKS_COLLAPSE_QUERY).matches : false,
    () => false
  );
}

// src/header/siteNavEntries.ts
var SITE_NAV_SECTION = 3;
function buildSiteNavEntries(navLinks, { homeHref, detailsHref, pathname }) {
  if (!navLinks?.length) return [];
  const alreadyAbove = [homeHref, detailsHref].filter((h) => h !== void 0);
  return navLinks.filter((link) => !alreadyAbove.includes(link.href)).map((link) => ({
    kind: "leaf",
    section: SITE_NAV_SECTION,
    item: {
      key: `nav:${link.href}`,
      label: link.label,
      href: link.href,
      icon: link.icon,
      current: (link.matchPaths ?? [link.href]).some((m) => pathMatches(pathname, m))
    }
  }));
}

// src/header/debugSiteGroups.ts
import { MAIN_SITE_IDS, MARKETING_SITE_IDS } from "@agentic-toolkit/adh-registry";
var DEBUG_SECTION = 2;
function buildDebugSiteGroups() {
  return [
    {
      kind: "topic",
      section: DEBUG_SECTION,
      label: "Marketing sites",
      links: MARKETING_SITE_IDS.map((site) => ({ site, external: true }))
    },
    {
      kind: "topic",
      section: DEBUG_SECTION,
      label: "Main sites",
      links: MAIN_SITE_IDS.map((site) => ({ site, external: true }))
    }
  ];
}

// src/header/devToolsEntries.ts
import { DEV_BUILD, isDevDeploymentEnv } from "@agentic-toolkit/adh-registry/deployment-env";
import "@agentic-toolkit/adh-registry";
import {
  buildRouteItems as buildRouteItems2
} from "@agentic-toolkit/adh/header";
var DEV_TOOLS_BUILD_ENABLED = DEV_BUILD;
function isDevEnv(env) {
  return isDevDeploymentEnv(env);
}
function buildDevToolsEntries({
  routes,
  effectiveEnv,
  realEnv,
  adminUnlocked,
  override,
  pathname,
  onOpenDebug
}) {
  const out = [];
  if (routes && routes.length > 0 && (adminUnlocked || isDevEnv(effectiveEnv))) {
    out.push({
      kind: "topic",
      section: DEBUG_SECTION,
      label: "Routes",
      icon: menuIcon("routes"),
      items: buildRouteItems2(routes, pathname)
    });
  }
  if (adminUnlocked || isDevEnv(realEnv)) {
    out.push({
      kind: "leaf",
      section: DEBUG_SECTION,
      // `blurb` is what actually RENDERS a leaf's description (see NavigationPopover's
      // leaf branch) — without it the "Sim: prod" hint below would be set but invisible.
      blurb: true,
      item: {
        key: "debug-options",
        label: "Debug Options",
        // Carries the old header pill's "Sim: prod" state, so it stays obvious the
        // site is being viewed AS production rather than for real. Kept OUT of the
        // label so the row's accessible name is stably "Debug Options".
        description: override === "production" ? "Sim: prod" : void 0,
        icon: menuIcon("debug"),
        onSelect: onOpenDebug
      }
    });
  }
  return out;
}

// src/header/envOverride.ts
import { useSyncExternalStore as useSyncExternalStore2 } from "react";
import { detectEnv as detectEnv2 } from "@agentic-toolkit/adh-registry";
var STORAGE_KEY = "adh:debug:env-override";
var ENV_VALUES = ["production", "staging", "testing", "local"];
function parseEnvOverride(raw) {
  return raw != null && ENV_VALUES.includes(raw) ? raw : null;
}
function resolveEffectiveEnv(override, detected) {
  return override ?? detected;
}
function readOverride() {
  if (typeof window === "undefined") return null;
  try {
    return parseEnvOverride(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}
var listeners = globalThis.__adhEnvOverrideListeners ??= /* @__PURE__ */ new Set();
function emit() {
  for (const fn of listeners) fn();
}
function subscribe(onChange) {
  listeners.add(onChange);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
function getEnvOverride() {
  return readOverride();
}
function setEnvOverride(env) {
  if (typeof window === "undefined") return;
  try {
    if (env !== null) window.localStorage.setItem(STORAGE_KEY, env);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  emit();
}
function useEnvOverride() {
  return useSyncExternalStore2(subscribe, readOverride, () => null);
}
function useEffectiveEnv(hostname) {
  const override = useEnvOverride();
  return resolveEffectiveEnv(override, hostname ? detectEnv2(hostname) : null);
}

// src/header/belowHelpEntries.ts
import { isConceptSite } from "@agentic-toolkit/adh/concepts/participating";
var BELOW_HELP_SECTION = 0;
function siteDetailsHref(siteId) {
  return isConceptSite(siteId) || siteId === "hub" ? "/details" : void 0;
}
function buildBelowHelpEntries({
  contactHref,
  detailsHref,
  pathname
}) {
  const out = [
    {
      kind: "leaf",
      section: BELOW_HELP_SECTION,
      item: {
        key: "route:/contact",
        label: "Contact",
        href: contactHref,
        icon: menuIcon("/contact"),
        // Only ever current on the hub, where the href is the bare path; elsewhere it is
        // an absolute URL, which never starts with '/'. The same test the config-driven
        // route rows apply in `useSiteMenu` — a destination must not highlight by one
        // rule here and another there.
        current: isSameOrigin(contactHref) && pathname === contactHref
      }
    }
  ];
  if (detailsHref)
    out.push({
      kind: "leaf",
      section: BELOW_HELP_SECTION,
      item: {
        key: "route:/details",
        label: "Details",
        href: detailsHref,
        icon: menuIcon("/details"),
        // Prefix-matched, so a details CHILD route (`/details/acme`) keeps the row lit —
        // matching how the bar's own `details` link behaved via `matchPaths`.
        current: pathname === detailsHref || pathname.startsWith(`${detailsHref}/`)
      }
    });
  return out;
}
function isSameOrigin(href) {
  return href.startsWith("/") && !href.startsWith("//");
}

// src/header/SiteMenu.tsx
import { useHelp } from "@agentic-toolkit/adh/help";
import { Fragment as Fragment5, jsx as jsx13, jsxs as jsxs9 } from "react/jsx-runtime";
var DebugConsoleWindow = dynamic(
  () => import("@agentic-toolkit/adh/debug-console").then((m) => m.DebugConsoleWindow)
);
function SiteMenu({
  groups,
  currentSiteId,
  authenticated,
  triggerContent,
  triggerClassName,
  resolveHref,
  personalSlug,
  settingsHref,
  onSettings,
  loginHref,
  signupHref,
  navLinks,
  routes,
  userIsAdmin,
  suppressDevTools
}) {
  const hub = getSite2("hub");
  const label = hub ? siteHeaderTitle(hub) : "Agentic Developer Hub";
  const devToolsUnlocked = DEV_TOOLS_BUILD_ENABLED || userIsAdmin === true;
  const menuGroups = useMemo3(
    () => devToolsUnlocked ? [...groups, ...buildDebugSiteGroups()] : groups,
    [groups, devToolsUnlocked]
  );
  const { entries, navigate, homeHref, routeHref } = useSiteMenu(menuGroups, { currentSiteId, resolveHref, personalSlug });
  const detailsHref = siteDetailsHref(currentSiteId);
  const pathname = usePathname3() ?? "/";
  const workspacesMenu = useWorkspacesMenu2();
  const recents = useRecents();
  const topSection = useMemo3(() => {
    if (!authenticated) {
      const out2 = [];
      if (loginHref) out2.push({ kind: "leaf", section: 0, item: { key: "login", label: "Login", href: loginHref, icon: menuIcon("login") } });
      if (signupHref) out2.push({ kind: "leaf", section: 0, item: { key: "signup", label: "Sign up", href: signupHref, icon: menuIcon("signup") } });
      return out2;
    }
    const out = [
      {
        kind: "leaf",
        section: 0,
        item: {
          key: "home",
          label: "Home",
          href: homeHref,
          icon: menuIcon("home"),
          current: homeHref.startsWith("/") && !homeHref.startsWith("//") && pathname === homeHref
        }
      }
    ];
    if (workspacesMenu && (workspacesMenu.workspaces.length || workspacesMenu.loading)) {
      const items = workspacesMenu.workspaces.map((w) => ({
        key: `ws:${w.id}`,
        label: w.label,
        href: w.href,
        current: w.current
      }));
      out.push({
        kind: "topic",
        section: 0,
        label: "Workspaces",
        icon: menuIcon("workspaces"),
        indent: true,
        items: items.length ? items : [{ key: "ws:loading", label: "Loading\u2026" }]
      });
    }
    if (recents.length) {
      const items = recents.map((r) => ({
        key: `recent:${r.url}`,
        label: r.label,
        href: r.url,
        icon: menuIcon(r.iconKey),
        current: r.url === pathname
      }));
      out.push({ kind: "topic", section: 0, label: "Recents", icon: menuIcon("recents"), items });
    }
    return out;
  }, [authenticated, loginHref, signupHref, homeHref, workspacesMenu, recents, pathname]);
  const linksCollapsed = useHeaderLinksCollapsed();
  const navSection = useMemo3(
    () => linksCollapsed ? buildSiteNavEntries(navLinks, {
      // Only signed in does `topSection` above render a Home row for these to
      // duplicate; signed out it is Login / Sign up. Passing `homeHref`
      // regardless would delete community's "Forum" (`/home`) from the menu of
      // an anonymous phone visitor and leave the board unreachable.
      homeHref: authenticated ? homeHref : void 0,
      // Unconditional, unlike homeHref: the Details row below Help is not
      // auth-gated, so wherever it exists it exists in both states.
      detailsHref,
      pathname
    }) : [],
    [linksCollapsed, navLinks, authenticated, homeHref, detailsHref, pathname]
  );
  const [generated, setGenerated] = useState4();
  const wantGeneratedRoutes = devToolsUnlocked && !suppressDevTools && !(routes && routes.length > 0);
  useEffect4(() => {
    if (!wantGeneratedRoutes) return;
    let cancelled = false;
    void import("@agentic-toolkit/adh-registry/routes").then(({ SITE_ROUTES }) => {
      if (cancelled) return;
      const paths = SITE_ROUTES[currentSiteId];
      setGenerated({
        siteId: currentSiteId,
        sections: paths?.length ? [{ label: "Site", routes: paths.map((path) => ({ path })) }] : []
      });
    });
    return () => {
      cancelled = true;
    };
  }, [wantGeneratedRoutes, currentSiteId]);
  const generatedRoutes = generated && generated.siteId === currentSiteId ? generated.sections : void 0;
  const effectiveRoutes = routes && routes.length > 0 ? routes : generatedRoutes;
  const host = useClientHost3();
  const effectiveEnv = useEffectiveEnv(host);
  const realEnv = host ? detectEnv3(host) : null;
  const override = useEnvOverride();
  const [debugOpen, setDebugOpen] = useState4(false);
  const devToolsSection = useMemo3(
    () => devToolsUnlocked && !suppressDevTools ? buildDevToolsEntries({
      routes: effectiveRoutes,
      effectiveEnv,
      realEnv,
      adminUnlocked: userIsAdmin === true,
      override,
      pathname,
      onOpenDebug: () => setDebugOpen(true)
    }) : [],
    [devToolsUnlocked, suppressDevTools, effectiveRoutes, effectiveEnv, realEnv, userIsAdmin, override, pathname]
  );
  const openHelp = useHelp().open;
  const belowHelp = useMemo3(
    () => buildBelowHelpEntries({ contactHref: routeHref("/contact"), detailsHref, pathname }),
    [routeHref, detailsHref, pathname]
  );
  const allEntries = useMemo3(
    () => [
      ...navSection,
      ...topSection,
      {
        kind: "leaf",
        section: 0,
        item: { key: "help", label: "Help", icon: menuIcon("help"), onSelect: () => openHelp() }
      },
      ...belowHelp,
      ...entries,
      ...devToolsSection
    ],
    [navSection, topSection, belowHelp, entries, devToolsSection, openHelp]
  );
  function showOverview() {
    requestAnimationFrame(() => {
      const el = document.getElementById(SITES_OVERVIEW_POPOVER_ID);
      if (!el || el.matches(":popover-open")) return;
      try {
        el.showPopover?.();
      } catch {
        return;
      }
      el.focus?.();
      const onKeyDown = (e) => {
        if (e.key === "Escape") el.hidePopover?.();
      };
      const onToggle = () => {
        if (!el.matches(":popover-open")) {
          document.removeEventListener("keydown", onKeyDown, true);
          el.removeEventListener("toggle", onToggle);
        }
      };
      document.addEventListener("keydown", onKeyDown, true);
      el.addEventListener("toggle", onToggle);
    });
  }
  return /* @__PURE__ */ jsxs9(Fragment5, { children: [
    /* @__PURE__ */ jsx13(
      NavigationPopover2,
      {
        entries: allEntries,
        onChoose: navigate,
        triggerLabel: `${label} \u2014 switch site`,
        triggerText: label,
        triggerIcon: /* @__PURE__ */ jsx13(HubMark2, { className: "adh-nav-popover__mark" }),
        triggerContent,
        triggerClassName,
        placeholder: "Search sites, or browse topics",
        emptyLabel: "No matching sites",
        searchCommand: {
          matches: (q) => q.toLowerCase() === "help",
          label: "Help \u2014 about the sites",
          shortcut: "overview",
          onSelect: showOverview
        },
        commandTrailing: ({ close }) => authenticated && onSettings ? /* @__PURE__ */ jsx13(
          "button",
          {
            type: "button",
            className: "adh-site-switcher__help",
            "aria-label": "User settings",
            onClick: () => {
              close({ restoreFocus: false });
              requestAnimationFrame(() => onSettings());
            },
            children: /* @__PURE__ */ jsx13(Settings2, { className: "adh-site-switcher__help-icon", "aria-hidden": true })
          }
        ) : authenticated && settingsHref ? (
          // A real link so middle-click / new-tab work; native nav tears down the
          // page, so no explicit close needed.
          /* @__PURE__ */ jsx13("a", { className: "adh-site-switcher__help", "aria-label": "User settings", href: settingsHref, children: /* @__PURE__ */ jsx13(Settings2, { className: "adh-site-switcher__help-icon", "aria-hidden": true }) })
        ) : /* @__PURE__ */ jsx13(
          "button",
          {
            type: "button",
            className: "adh-site-switcher__help",
            "aria-label": "About the Agentic Developer family",
            onClick: () => {
              close({ restoreFocus: false });
              showOverview();
            },
            children: /* @__PURE__ */ jsx13(CircleHelp2, { className: "adh-site-switcher__help-icon", "aria-hidden": true })
          }
        )
      }
    ),
    debugOpen && !suppressDevTools && /* @__PURE__ */ jsx13(DebugConsoleWindow, { open: true, onClose: () => setDebugOpen(false) })
  ] });
}

// src/header/MarketingSiteMenu.tsx
import { useMemo as useMemo4 } from "react";

// src/header/hubCoreGroups.ts
var HUB_SECTION = 1;
var inline = (link) => ({
  kind: "inline",
  section: HUB_SECTION,
  blurb: true,
  link
});
var ALWAYS_SUBITEMS = [
  inline({ site: "bitbag", description: "The hub's AI Persona, here to help!" }),
  inline({ site: "community", description: "The hub's forums & discussions" }),
  inline({ site: "personaregistry" }),
  inline({ site: "toolkit" }),
  inline({ site: "cookbook" }),
  inline({ site: "devteam", description: "Your LLM agentic dev team" }),
  inline({ site: "myagenticteams", description: "Build your own agentic teams" }),
  inline({ site: "narratives", description: "Your project development story" }),
  // hub-help (help.adh.com), not the delisted 'help' landing — the family's Help
  // destination since its promotion; also keeps this row's key distinct from the
  // Help-modal action row SiteMenu adds (both keyed by site id / 'help' before).
  inline({ site: "hub-help", description: "Top level help site" })
];
var AUTHED_SUBITEMS = [
  inline({ site: "news", description: "The latest Hub news!" }),
  // Products replaced the old /ecosystems rail feature (each product IS an ecosystem).
  inline({ route: "/products", label: "Products", description: "Build and manage your products" }),
  inline({ route: "/personas", label: "Personas", description: "Register and configure your personas" }),
  inline({ route: "/organizations", label: "Organizations", description: "Manage your organizations" }),
  inline({ route: "/research", label: "Research", description: "Write, organize, and publish your research" })
];
function hubCoreGroups(authenticated) {
  return [
    { kind: "leaf", section: HUB_SECTION, blurb: true, link: { site: "hub", description: "The center of the Agentic Developer ecosystem" } },
    ...ALWAYS_SUBITEMS,
    ...authenticated ? AUTHED_SUBITEMS : []
  ];
}

// src/header/MarketingSiteMenu.tsx
import { jsx as jsx14 } from "react/jsx-runtime";
function MarketingSiteMenu(props) {
  const groups = useMemo4(() => hubCoreGroups(props.authenticated ?? false), [props.authenticated]);
  return /* @__PURE__ */ jsx14(SiteMenu, { groups, ...props });
}

// src/header/WorkspaceSiteMenu.tsx
import { useMemo as useMemo5 } from "react";
import { jsx as jsx15 } from "react/jsx-runtime";
function WorkspaceSiteMenu(props) {
  const groups = useMemo5(() => hubCoreGroups(props.authenticated ?? false), [props.authenticated]);
  return /* @__PURE__ */ jsx15(SiteMenu, { groups, ...props });
}

// src/header/activeMenuGroups.ts
import "@agentic-toolkit/adh-registry";
import { isHubWorkspacePath as isHubWorkspacePath2 } from "@agentic-toolkit/adh/site/hubWorkspacePath";
function isWorkspaceMenuRoute(currentSiteId, pathname) {
  return currentSiteId === "hub" && isHubWorkspacePath2(pathname);
}

// src/header/PrefetchSiblingSites.tsx
import { useEffect as useEffect5 } from "react";
import { detectEnv as detectEnv4 } from "@agentic-toolkit/adh-registry";
function PrefetchSiblingSites() {
  useEffect5(() => {
    if (typeof window === "undefined") return;
    if (detectEnv4(window.location.hostname) !== "local") return;
    const hostPattern = window.location.host.replace(/^[^.]+/, "*");
    const rules = {
      prerender: [
        {
          where: { href_matches: `${window.location.protocol}//${hostPattern}/*` },
          eagerness: "moderate"
        }
      ]
    };
    const script = document.createElement("script");
    script.type = "speculationrules";
    script.textContent = JSON.stringify(rules);
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);
  return null;
}

// src/header/SiteMenuSwitcher.tsx
import { jsx as jsx16, jsxs as jsxs10 } from "react/jsx-runtime";
function SiteMenuSwitcher(props) {
  const pathname = usePathname4() ?? "/";
  const onWorkspaceRoute = isWorkspaceMenuRoute(props.currentSiteId, pathname);
  return /* @__PURE__ */ jsxs10(Fragment6, { children: [
    /* @__PURE__ */ jsx16(PrefetchSiblingSites, {}),
    onWorkspaceRoute ? /* @__PURE__ */ jsx16(WorkspaceSiteMenu, { ...props }) : /* @__PURE__ */ jsx16(MarketingSiteMenu, { ...props })
  ] });
}

// src/header/SiteHeader.tsx
import { jsx as jsx17 } from "react/jsx-runtime";
function SiteHeader({
  siteId,
  pageTitle,
  center,
  badges,
  leadingActions,
  navLinks,
  trailingNavLinks = [],
  previewNotice,
  previewDetail,
  routes,
  personalSlug,
  clientId,
  onAfterLogout,
  useAuthSource = useAnonymousHeaderAuth,
  ...authOverrides
}) {
  const source = useAuthSource({ clientId, siteId, onAfterLogout });
  const {
    resolveSwitchHref,
    user,
    userIsAdmin,
    authLoading = false,
    loginHref,
    signupHref,
    onLogin,
    onSignup,
    onLogout,
    settingsHref,
    onSettings
  } = { ...source, ...authOverrides };
  const resolvedNavLinks = (typeof navLinks === "function" ? navLinks(user != null) : navLinks) ?? [];
  const hostname = useClientHost4();
  const conceptSite = isConceptSite2(siteId);
  const site = getSite3(siteId);
  const siteName = site ? siteHeaderTitle2(site) : siteId;
  const resolveHubHref = (path) => hostname ? siteUrl2("hub", path, hostname) : siteProdUrl2("hub", path);
  const selfReturn = hostname ? siteUrl2(siteId, siteHomePath(siteId), hostname) : siteProdUrl2(siteId, siteHomePath(siteId));
  const hubAuthHref = (path) => `${resolveHubHref(path)}?return_to=${encodeURIComponent(selfReturn)}`;
  const resolvedLoginHref = loginHref ?? (onLogin ? void 0 : hubAuthHref("/login"));
  const resolvedSignupHref = signupHref ?? (onSignup ? void 0 : hubAuthHref("/signup"));
  const switcherSettingsHref = onSettings ? void 0 : settingsHref ?? resolveHubHref("/settings");
  return /* @__PURE__ */ jsx17(
    AdhHeader2,
    {
      siteName,
      siteSwitcher: /* @__PURE__ */ jsx17(
        SiteMenuSwitcher,
        {
          currentSiteId: siteId,
          resolveHref: resolveSwitchHref,
          personalSlug,
          authenticated: user != null,
          onSettings,
          settingsHref: switcherSettingsHref,
          loginHref: resolvedLoginHref,
          signupHref: resolvedSignupHref,
          navLinks: resolvedNavLinks,
          routes,
          userIsAdmin
        }
      ),
      pageTitle,
      center,
      badges,
      leadingActions,
      navLinks: resolvedNavLinks,
      trailingNavLinks,
      previewNotice,
      previewDetail,
      homeHref: siteHomePath(siteId),
      preAuthLinks: conceptSite ? /* @__PURE__ */ jsx17("a", { href: "/details", className: "adh-header__nav-link adh-header__nav-link--details", children: "Details" }) : void 0,
      user,
      authLoading,
      loginHref: resolvedLoginHref,
      signupHref: resolvedSignupHref,
      onLogin,
      onSignup,
      onLogout,
      settingsHref,
      onSettings
    }
  );
}

// src/header/index.ts
import {
  RECENTS_CAP,
  clearRecents,
  readRecents,
  recordRecent,
  useRecents as useRecents2
} from "@agentic-toolkit/adh/header/recents";
export {
  AdhHeader,
  AuthButtons,
  AvatarMenu,
  DEBUG_SECTION,
  DEV_TOOLS_BUILD_ENABLED,
  HubMark,
  MarketingSiteMenu,
  NavLinkItem,
  NavigationPopover,
  PrefetchSiblingSites,
  RECENTS_CAP,
  SiteHeader,
  SiteMenu,
  SiteMenuSwitcher,
  SiteOptionsMenu,
  SiteSwitcher,
  WorkspaceSiteMenu,
  WorkspacesMenuProvider,
  buildDebugSiteGroups,
  buildDevToolsEntries,
  buildRouteItems,
  clearRecents,
  currentRoutePath,
  getEnvOverride,
  hubCoreGroups,
  isWorkspaceMenuRoute,
  menuIcon,
  parseEnvOverride,
  pathMatches,
  readRecents,
  recordRecent,
  resolveEffectiveEnv,
  setEnvOverride,
  useClientHost,
  useEffectiveEnv,
  useEnvOverride,
  useRecents2 as useRecents,
  useSiteMenu,
  useWorkspacesMenu
};
//# sourceMappingURL=index.js.map