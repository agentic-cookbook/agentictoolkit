'use client'

"use client";

// src/footer/AdhFooter.tsx
import Link from "next/link";
import { jsx, jsxs } from "react/jsx-runtime";
function AdhFooter({ links = [], copyright, version, trailing }) {
  return /* @__PURE__ */ jsxs("footer", { className: "adh-footer", role: "contentinfo", children: [
    /* @__PURE__ */ jsxs("div", { className: "adh-footer__container", children: [
      copyright && /* @__PURE__ */ jsx("span", { className: "adh-footer__copyright", children: copyright }),
      version && /* @__PURE__ */ jsx("span", { className: "adh-footer__version", children: version }),
      links.length > 0 && /* @__PURE__ */ jsx("nav", { className: "adh-footer__links", "aria-label": "Footer", children: links.map(
        (link) => "popoverTarget" in link ? /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            popoverTarget: link.popoverTarget,
            "aria-label": link.ariaLabel,
            className: "adh-footer__link adh-footer__sites-trigger",
            children: link.label
          },
          `popover:${link.popoverTarget}`
        ) : /* @__PURE__ */ jsx(
          Link,
          {
            href: link.href,
            className: "adh-footer__link",
            onClick: link.onSelect,
            prefetch: link.prefetch,
            children: link.label
          },
          `href:${link.href}:${link.label}`
        )
      ) })
    ] }),
    trailing
  ] });
}

// src/footer/SiteFooter.tsx
import { AdhFooter as ToolkitFooter } from "@agentic-toolkit/adh/footer";

// src/footer/FooterChat.tsx
import dynamic from "next/dynamic";
import { jsx as jsx2 } from "react/jsx-runtime";
var FooterChatInner = dynamic(() => import("@agentic-toolkit/adh/footer/FooterChatInner"), {
  ssr: false
});
function FooterChat() {
  return /* @__PURE__ */ jsx2(FooterChatInner, {});
}

// src/footer/SitesOverview.tsx
import { FOOTER_SITES, groupSitesByCategory, siteProdUrl } from "@agentic-toolkit/adh-registry";

// src/footer/AdhModalPopover.tsx
import { X } from "lucide-react";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function AdhModalPopover({ id, title, children, bodyClassName }) {
  const titleId = `${id}-title`;
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      id,
      popover: "auto",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      tabIndex: -1,
      className: "adh-modal",
      children: [
        /* @__PURE__ */ jsxs2("div", { className: "adh-modal__header", children: [
          /* @__PURE__ */ jsx3("h2", { id: titleId, className: "adh-modal__title", children: title }),
          /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              className: "adh-modal__close",
              popoverTarget: id,
              popoverTargetAction: "hide",
              "aria-label": "Close",
              children: /* @__PURE__ */ jsx3(X, { className: "adh-modal__close-icon", "aria-hidden": true })
            }
          )
        ] }),
        /* @__PURE__ */ jsx3("div", { className: `adh-modal__body${bodyClassName ? ` ${bodyClassName}` : ""}`, children })
      ]
    }
  );
}

// src/footer/SitesOverview.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var SITES_OVERVIEW_POPOVER_ID = "adh-sites-overview";
function SitesPopover() {
  const groups = groupSitesByCategory(FOOTER_SITES);
  return /* @__PURE__ */ jsx4(AdhModalPopover, { id: SITES_OVERVIEW_POPOVER_ID, title: "The Agentic Developer family", children: groups.map((group) => /* @__PURE__ */ jsxs3(
    "nav",
    {
      className: "adh-sites-popover__group",
      "aria-label": group.label,
      children: [
        /* @__PURE__ */ jsx4("h3", { className: "adh-sites-popover__group-title", children: group.label }),
        /* @__PURE__ */ jsx4("ul", { className: "adh-sites-popover__list", children: group.sites.map((site) => /* @__PURE__ */ jsx4("li", { children: /* @__PURE__ */ jsxs3(
          "a",
          {
            className: "adh-sites-popover__item",
            href: siteProdUrl(site.id, "/"),
            children: [
              /* @__PURE__ */ jsx4("span", { className: "adh-sites-popover__name", children: site.label }),
              site.description && /* @__PURE__ */ jsx4("span", { className: "adh-sites-popover__blurb", children: site.description })
            ]
          }
        ) }, site.id)) })
      ]
    },
    group.label
  )) });
}

// src/footer/LegalModals.tsx
import { useEffect, useState } from "react";
import { LEGAL_EFFECTIVE_DATE, TermsBody, PrivacyBody } from "@agentic-toolkit/adh/legal";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var TERMS_DIALOG_ID = "adh-terms-dialog";
var PRIVACY_DIALOG_ID = "adh-privacy-dialog";
function useOpenedOnce(id) {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (opened) return;
    const el = document.getElementById(id);
    if (!el) return;
    const onToggle = (e) => {
      if (e.newState === "open") setOpened(true);
    };
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, [id, opened]);
  return opened;
}
function LegalDoc({ children }) {
  return /* @__PURE__ */ jsxs4("article", { className: "adh-legal-doc", children: [
    /* @__PURE__ */ jsxs4("p", { className: "adh-legal-doc__meta", children: [
      "Effective ",
      LEGAL_EFFECTIVE_DATE
    ] }),
    children
  ] });
}
function TermsModal() {
  const opened = useOpenedOnce(TERMS_DIALOG_ID);
  return /* @__PURE__ */ jsx5(AdhModalPopover, { id: TERMS_DIALOG_ID, title: "Terms of Service", bodyClassName: "adh-modal__body--legal", children: opened && /* @__PURE__ */ jsx5(LegalDoc, { children: /* @__PURE__ */ jsx5(TermsBody, {}) }) });
}
function PrivacyModal() {
  const opened = useOpenedOnce(PRIVACY_DIALOG_ID);
  return /* @__PURE__ */ jsx5(AdhModalPopover, { id: PRIVACY_DIALOG_ID, title: "Privacy Policy", bodyClassName: "adh-modal__body--legal", children: opened && /* @__PURE__ */ jsx5(LegalDoc, { children: /* @__PURE__ */ jsx5(PrivacyBody, {}) }) });
}
function openLegalModal(dialogId) {
  return (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = document.getElementById(dialogId);
    if (el && "showPopover" in el) {
      e.preventDefault();
      el.showPopover();
    }
  };
}

// src/footer/SiteFooter.tsx
import { Fragment, jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var COPYRIGHT_PREFIX = "\xA9 2026 ";
var BRAND_LABEL = "Agentic Development Studio";
var BRAND_HREF = "https://agenticdevelopmentstudio.com/";
var SITES_LINK = {
  label: "Sites",
  popoverTarget: SITES_OVERVIEW_POPOVER_ID,
  ariaLabel: "Sites \u2014 Agentic Developer family overview"
};
var LEGAL_LINKS = [
  { label: "Terms", href: "/terms", onSelect: openLegalModal(TERMS_DIALOG_ID), prefetch: false },
  { label: "Privacy", href: "/privacy", onSelect: openLegalModal(PRIVACY_DIALOG_ID), prefetch: false }
];
function buildVersionLabel(live) {
  const version = live?.version ?? process.env.NEXT_PUBLIC_ADH_SITE_VERSION ?? "";
  const sha = live?.sha ?? process.env.NEXT_PUBLIC_ADH_RELEASE ?? "";
  const label = [version && `v${version}`, sha && sha.slice(0, 8)].filter(Boolean).join(" \xB7 ");
  if (!label) return null;
  return /* @__PURE__ */ jsx6("span", { title: sha || void 0, children: label });
}
function SiteFooter({ links = [], chat = true, live }) {
  return /* @__PURE__ */ jsxs5(Fragment, { children: [
    /* @__PURE__ */ jsx6(
      ToolkitFooter,
      {
        links: [SITES_LINK, ...links, ...LEGAL_LINKS],
        copyright: /* @__PURE__ */ jsxs5(Fragment, { children: [
          COPYRIGHT_PREFIX,
          /* @__PURE__ */ jsx6("a", { className: "adh-footer__brand-link", href: BRAND_HREF, children: BRAND_LABEL })
        ] }),
        version: buildVersionLabel(live),
        trailing: chat ? /* @__PURE__ */ jsx6(FooterChat, {}) : null
      }
    ),
    /* @__PURE__ */ jsx6(SitesPopover, {}),
    /* @__PURE__ */ jsx6(TermsModal, {}),
    /* @__PURE__ */ jsx6(PrivacyModal, {})
  ] });
}

// src/footer/seededBackend.ts
var BITBAG_PERSONA = { name: "bitbag" };
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) | 0;
  return h;
}
var SeededBackend = class {
  constructor(opts) {
    this.opts = opts;
  }
  opts;
  async sendMessage(text, _history) {
    await new Promise((r) => setTimeout(r, this.opts.delayMs ?? 450));
    for (const { match, reply } of this.opts.seeded) {
      if (match.test(text)) return reply;
    }
    const { fallbacks } = this.opts;
    return fallbacks[Math.abs(hash(text)) % fallbacks.length] ?? fallbacks[0];
  }
};
function createSeededBackend(opts) {
  return new SeededBackend(opts);
}

// src/footer/chat-theme-store.ts
import { useCallback, useSyncExternalStore } from "react";
import { themeIds } from "@agentic-toolkit/bitbag";
import { DEV_BUILD } from "@agentic-toolkit/adh-registry/deployment-env";
var STORAGE_KEY = "adh-chat-theme";
var THEME_SWITCH_ENABLED = DEV_BUILD;
function readStored() {
  if (!THEME_SWITCH_ENABLED) return null;
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && themeIds.includes(v)) return v;
  } catch {
  }
  return null;
}
function writeStored(next) {
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, next);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  window.dispatchEvent(new CustomEvent(STORAGE_KEY));
}
function subscribe(callback) {
  if (typeof window === "undefined") return () => {
  };
  window.addEventListener(STORAGE_KEY, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_KEY, callback);
    window.removeEventListener("storage", callback);
  };
}
function useChatTheme() {
  const theme = useSyncExternalStore(subscribe, readStored, () => null);
  const setTheme = useCallback((next) => writeStored(next), []);
  return [theme, setTheme];
}
export {
  AdhFooter,
  BITBAG_PERSONA,
  SITES_OVERVIEW_POPOVER_ID,
  SiteFooter,
  createSeededBackend,
  useChatTheme
};
//# sourceMappingURL=index.js.map