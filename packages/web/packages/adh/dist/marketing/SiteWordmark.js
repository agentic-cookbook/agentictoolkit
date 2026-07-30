// src/marketing/SiteWordmark.tsx
import { HubMark } from "@agentic-toolkit/adh/header";
import { getSite, splitSiteTitle } from "@agentic-toolkit/adh-registry";
import { jsx, jsxs } from "react/jsx-runtime";
function SiteWordmark({ siteId, tagline, className }) {
  const site = getSite(siteId);
  const { titleLead, titleAccent } = site ? splitSiteTitle(site) : { titleLead: "", titleAccent: siteId };
  const identity = tagline === void 0 ? site?.description : tagline;
  return /* @__PURE__ */ jsxs("div", { className, children: [
    /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-2 font-serif text-lg leading-tight font-medium tracking-tight text-apt-text sm:text-xl", children: [
      /* @__PURE__ */ jsx(HubMark, { className: "h-[1.2em] w-[1.2em] shrink-0 text-apt-gold" }),
      /* @__PURE__ */ jsxs("span", { children: [
        titleLead ? `${titleLead} ` : null,
        /* @__PURE__ */ jsx("span", { className: "text-apt-gold italic", children: titleAccent })
      ] })
    ] }),
    identity ? /* @__PURE__ */ jsx("p", { className: "mt-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-apt-text-dim", children: identity }) : null
  ] });
}
export {
  SiteWordmark
};
//# sourceMappingURL=SiteWordmark.js.map