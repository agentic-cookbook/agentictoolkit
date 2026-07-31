// src/details/DetailsPage.tsx
import {
  getConcept as getConcept2,
  hasDetailPage as hasDetailPage2,
  ownerSiteOf,
  relatedOf,
  siteConcept,
  subtreeOf
} from "@agentic-toolkit/adh/concepts";

// src/concepts/details-links.ts
import { SITE_ROUTES } from "@agentic-toolkit/adh-registry/routes";
import { siteProdUrl } from "@agentic-toolkit/adh-registry";
var SHARED_TOPIC_ROUTE = "/details/[topic]";
function servesConceptDetails(siteId) {
  return (SITE_ROUTES[siteId] ?? []).includes(SHARED_TOPIC_ROUTE);
}
function conceptDetailsUrl(conceptId, ownerSiteId, currentSiteId) {
  if (!ownerSiteId || ownerSiteId === currentSiteId) return `/details/${conceptId}`;
  return siteProdUrl(ownerSiteId, servesConceptDetails(ownerSiteId) ? `/details/${conceptId}` : "/");
}

// src/details/DetailsPage.tsx
import { siteProdUrl as siteProdUrl3 } from "@agentic-toolkit/adh-registry";
import { DetailsRail } from "@agentic-toolkit/adh/details/DetailsRail";

// src/details/Breadcrumb.tsx
import { ancestorsOf, getConcept, hasDetailPage } from "@agentic-toolkit/adh/concepts";
import { siteProdUrl as siteProdUrl2 } from "@agentic-toolkit/adh-registry";
import { jsx, jsxs } from "react/jsx-runtime";
function pathFor(node) {
  if (hasDetailPage(node)) return `/details/${node.id}`;
  return node.id === "hub" ? "/" : `/?focus=${node.id}`;
}
function Breadcrumb({ siteId, topicId }) {
  const node = getConcept(topicId);
  if (!node) return null;
  const trail = [...ancestorsOf(topicId), node];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((n, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: n.label,
      item: siteProdUrl2(siteId, pathFor(n))
    }))
  };
  return /* @__PURE__ */ jsxs("nav", { className: "adh-details__crumbs", "aria-label": "Breadcrumb", children: [
    /* @__PURE__ */ jsx("ol", { children: trail.map((n, i) => {
      const last = i === trail.length - 1;
      return /* @__PURE__ */ jsxs("li", { children: [
        i > 0 && /* @__PURE__ */ jsx("span", { className: "adh-details__crumb-sep", "aria-hidden": "true", children: "\u203A" }),
        last ? /* @__PURE__ */ jsx("span", { "aria-current": "page", children: n.label }) : /* @__PURE__ */ jsx("a", { href: pathFor(n), children: n.label })
      ] }, n.id);
    }) }),
    /* @__PURE__ */ jsx(
      "script",
      {
        type: "application/ld+json",
        dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }
      }
    )
  ] });
}

// src/details/DetailSections.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function DetailSections({ sections }) {
  return /* @__PURE__ */ jsx2(Fragment, { children: sections.map((section, i) => {
    const key = `${section.kind}-${i}`;
    if (section.kind === "prose") {
      return /* @__PURE__ */ jsxs2("section", { className: "adh-details__block", children: [
        section.heading && /* @__PURE__ */ jsx2("h2", { className: "adh-details__h2", children: section.heading }),
        /* @__PURE__ */ jsx2("p", { className: "adh-details__prose", children: section.body })
      ] }, key);
    }
    if (section.kind === "points") {
      return /* @__PURE__ */ jsxs2("section", { className: "adh-details__block", children: [
        section.heading && /* @__PURE__ */ jsx2("h2", { className: "adh-details__h2", children: section.heading }),
        /* @__PURE__ */ jsx2("ul", { className: "adh-details__points", children: section.items.map((item, j) => /* @__PURE__ */ jsx2("li", { children: item }, j)) })
      ] }, key);
    }
    return /* @__PURE__ */ jsxs2("section", { className: "adh-details__block", children: [
      section.heading && /* @__PURE__ */ jsx2("h2", { className: "adh-details__h2", children: section.heading }),
      /* @__PURE__ */ jsx2("pre", { className: "adh-details__diagram", children: section.ascii })
    ] }, key);
  }) });
}

// src/details/DetailsPage.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function DetailsPage({ siteId, topic }) {
  const siteNode = siteConcept(siteId);
  const node = topic ? getConcept2(topic) : siteNode;
  if (!node || !siteNode) return null;
  const railTopics = subtreeOf(siteNode.id).filter(hasDetailPage2).map((t) => ({
    id: t.id,
    label: t.label,
    href: `/details/${t.id}`,
    active: t.id === node.id,
    leaf: t.id !== siteNode.id
  }));
  const sections = node.detail ?? (node.keyPoints?.length ? [{ kind: "points", heading: "Key points", items: node.keyPoints }] : []);
  const related = relatedOf(node.id);
  const relatedHref = (r) => conceptDetailsUrl(r.id, ownerSiteOf(r.id), siteId);
  return /* @__PURE__ */ jsxs3("div", { className: "adh-details", children: [
    /* @__PURE__ */ jsxs3("aside", { className: "adh-details__rail", children: [
      /* @__PURE__ */ jsx3("a", { className: "adh-details__back", href: "/", children: "\u2039 Back to the map" }),
      /* @__PURE__ */ jsx3("p", { className: "adh-details__rail-label", children: siteNode.label }),
      /* @__PURE__ */ jsx3(DetailsRail, { topics: railTopics, siteLabel: siteNode.label })
    ] }),
    /* @__PURE__ */ jsxs3("main", { className: "adh-details__main", children: [
      /* @__PURE__ */ jsx3(Breadcrumb, { siteId, topicId: node.id }),
      node.kicker && /* @__PURE__ */ jsx3("p", { className: "adh-details__kicker", children: node.kicker }),
      /* @__PURE__ */ jsx3("h1", { className: "adh-details__title", children: node.label }),
      /* @__PURE__ */ jsx3("p", { className: "adh-details__lead", children: node.blurb }),
      node.ctas && node.ctas.length > 0 && /* @__PURE__ */ jsx3("div", { className: "adh-details__ctas", children: node.ctas.map((c) => /* @__PURE__ */ jsx3(
        "a",
        {
          className: "adh-details__cta",
          href: c.href,
          ...c.external ? { target: "_blank", rel: "noopener noreferrer" } : {},
          children: c.label
        },
        c.href
      )) }),
      /* @__PURE__ */ jsx3(DetailSections, { sections }),
      node.docs && /* @__PURE__ */ jsx3("div", { className: "adh-details__docs", children: /* @__PURE__ */ jsx3(
        "a",
        {
          className: "adh-details__cta",
          href: siteProdUrl3("hub-help", `/${node.docs}`),
          children: "Read the docs \u2192"
        }
      ) }),
      related.length > 0 && /* @__PURE__ */ jsxs3("div", { className: "adh-details__related", children: [
        /* @__PURE__ */ jsx3("p", { className: "adh-details__related-label", children: "Connected" }),
        /* @__PURE__ */ jsx3("div", { className: "adh-details__chips", children: related.map((r) => /* @__PURE__ */ jsx3("a", { className: "adh-details__chip", href: relatedHref(r), children: r.label }, r.id)) })
      ] })
    ] })
  ] });
}

// src/details/metadata.ts
import { getConcept as getConcept3, siteConcept as siteConcept2 } from "@agentic-toolkit/adh/concepts";
import { getSite, siteProdUrl as siteProdUrl4 } from "@agentic-toolkit/adh-registry";
import { siteMetadata } from "@agentic-toolkit/adh-registry/seo";
function detailsMetadata(siteId, topic) {
  const site = getSite(siteId);
  const brand = site ? site.fullLabel ?? site.label : "Agentic Developer Hub";
  const node = topic ? getConcept3(topic) : siteConcept2(siteId);
  if (!node) return {};
  const path = topic ? `/details/${topic}` : "/details";
  const url = siteProdUrl4(siteId, path);
  const base = siteMetadata(siteId, {
    title: `${node.label} \u2014 ${brand}`,
    description: node.blurb,
    path
  });
  return {
    ...base,
    // Absolute, and deliberately kept over the relative one `path` produces:
    // identical in effect, but it survives a page being rendered without the
    // layout's `metadataBase`.
    alternates: { canonical: url },
    // These really are articles, not the site's front door.
    openGraph: { ...base.openGraph, type: "article", title: node.label, url }
  };
}
export {
  Breadcrumb,
  DetailSections,
  DetailsPage,
  detailsMetadata
};
//# sourceMappingURL=index.js.map