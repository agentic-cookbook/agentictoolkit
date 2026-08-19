'use client'

"use client";

// src/details/DetailsRail.tsx
import { useRef, useState } from "react";
import { noAutofillProps } from "@agentic-toolkit/ui/lib/autofill";
import { cn } from "@agentic-toolkit/ui/lib/utils";
import { railLinkVariants } from "@agentic-toolkit/ui/lib/nav-rail";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function DetailsRail({ topics, siteLabel }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const linkRefs = useRef([]);
  const q = query.trim().toLowerCase();
  const filtered = q ? topics.filter((t) => t.label.toLowerCase().includes(q)) : topics;
  const focusItem = (i) => {
    const n = filtered.length;
    if (n === 0) return;
    linkRefs.current[Math.max(0, Math.min(n - 1, i))]?.focus();
  };
  const onInputKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(0);
    }
  };
  const onItemKey = (e, i) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i === 0) inputRef.current?.focus();
      else focusItem(i - 1);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        ref: inputRef,
        type: "text",
        className: "adh-details__rail-filter",
        placeholder: "Filter topics\u2026",
        value: query,
        onChange: (e) => setQuery(e.target.value),
        onKeyDown: onInputKey,
        "aria-label": `Filter ${siteLabel} topics`,
        "aria-controls": "adh-details-rail-nav",
        ...noAutofillProps
      }
    ),
    /* @__PURE__ */ jsxs(
      "nav",
      {
        id: "adh-details-rail-nav",
        className: "adh-details__rail-nav",
        "aria-label": `${siteLabel} topics`,
        children: [
          filtered.map((t, i) => /* @__PURE__ */ jsx(
            "a",
            {
              ref: (el) => {
                linkRefs.current[i] = el;
              },
              href: t.href,
              className: cn(railLinkVariants({ active: t.active, leaf: t.leaf })),
              "aria-current": t.active ? "page" : void 0,
              onKeyDown: (e) => onItemKey(e, i),
              children: t.label
            },
            t.id
          )),
          filtered.length === 0 && /* @__PURE__ */ jsx("p", { className: "adh-details__rail-empty", children: "No matching topics" })
        ]
      }
    )
  ] });
}
export {
  DetailsRail
};
//# sourceMappingURL=DetailsRail.js.map