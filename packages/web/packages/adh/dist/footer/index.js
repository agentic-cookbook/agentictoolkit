'use client'

"use client";

// src/footer/AdhFooter.tsx
import Link from "next/link";
import { jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_LINKS = [
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" }
];
function AdhFooter({ links = DEFAULT_LINKS, copyright }) {
  return /* @__PURE__ */ jsx("footer", { className: "adh-footer", role: "contentinfo", children: /* @__PURE__ */ jsxs("div", { className: "adh-footer__container", children: [
    copyright && /* @__PURE__ */ jsx("span", { className: "adh-footer__copyright", children: copyright }),
    links.length > 0 && /* @__PURE__ */ jsx("nav", { className: "adh-footer__links", "aria-label": "Footer", children: links.map((link) => /* @__PURE__ */ jsx(
      Link,
      {
        href: link.href,
        className: "adh-footer__link",
        children: link.label
      },
      link.href + link.label
    )) })
  ] }) });
}
export {
  AdhFooter
};
//# sourceMappingURL=index.js.map