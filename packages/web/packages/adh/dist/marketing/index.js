// src/marketing/MarketingLanding.tsx
import { siteConcept as siteConcept2 } from "@agentic-toolkit/adh/concepts";
import { getSite as getSite2, splitSiteTitle } from "@agentic-toolkit/adh-registry";

// src/layout/SiteLanding.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var SERIF = "var(--font-serif, ui-serif, Georgia, serif)";
var SANS = "var(--font-sans, ui-sans-serif, system-ui, sans-serif)";
var MONO = "var(--font-mono, ui-monospace, monospace)";
var TEXT = "var(--color-text-primary, #e8e6e3)";
var MUTED = "var(--color-text-secondary, #8a8a9a)";
var ACCENT = "var(--color-accent, #c4a35a)";
var BORDER = "var(--color-border, #2a2a35)";
var wrap = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "5rem 1.5rem",
  fontFamily: SERIF,
  color: TEXT
};
function SiteLanding({
  eyebrow,
  titleLead = "Agentic Developer",
  titleAccent,
  blurb
}) {
  return /* @__PURE__ */ jsx("main", { style: wrap, children: /* @__PURE__ */ jsxs("div", { style: { maxWidth: 720 }, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          fontFamily: `var(--type-landing-eyebrow-font, ${MONO})`,
          fontSize: "var(--type-landing-eyebrow-size, 0.7rem)",
          lineHeight: "var(--type-landing-eyebrow-line-height, 1.4)",
          letterSpacing: "var(--type-landing-eyebrow-tracking, 0.24em)",
          fontWeight: "var(--type-landing-eyebrow-weight, 500)",
          textTransform: "var(--type-landing-eyebrow-transform, uppercase)",
          color: MUTED,
          marginBottom: "1.75rem"
        },
        children: eyebrow
      }
    ),
    /* @__PURE__ */ jsxs(
      "h1",
      {
        style: {
          fontFamily: `var(--type-landing-title-font, ${SERIF})`,
          fontSize: "var(--type-landing-title-size, clamp(2.6rem, 6vw, 4.5rem))",
          lineHeight: "var(--type-landing-title-line-height, 1.04)",
          letterSpacing: "var(--type-landing-title-tracking, -0.02em)",
          fontWeight: "var(--type-landing-title-weight, 400)",
          margin: "0 0 1.5rem"
        },
        children: [
          titleLead,
          " ",
          /* @__PURE__ */ jsx("span", { style: { color: ACCENT, fontStyle: "italic" }, children: titleAccent })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "p",
      {
        style: {
          fontFamily: `var(--type-landing-lede-font, ${SANS})`,
          fontSize: "var(--type-landing-lede-size, 1.1rem)",
          lineHeight: "var(--type-landing-lede-line-height, 1.7)",
          fontWeight: "var(--type-landing-lede-weight, 400)",
          letterSpacing: "var(--type-landing-lede-tracking, 0)",
          color: MUTED,
          margin: "0 auto 2.75rem",
          maxWidth: 560
        },
        children: blurb
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        role: "separator",
        "aria-hidden": "true",
        style: {
          height: 1,
          background: `linear-gradient(to right, transparent, ${BORDER}, transparent)`,
          margin: "1rem 0 0"
        }
      }
    )
  ] }) });
}

// src/marketing/MarketingLanding.tsx
import { LandingGraph } from "@agentic-toolkit/adh/graph";
import { LandingHeroGate } from "@agentic-toolkit/adh/marketing/LandingHeroGate";

// src/marketing/StorySections.tsx
import { getSite, siteHeaderTitle, siteProdUrl } from "@agentic-toolkit/adh-registry";
import { getSiteStory } from "@agentic-toolkit/adh-registry";
import { siteConcept } from "@agentic-toolkit/adh/concepts";

// src/marketing/story-copy.ts
var BRAND_PROMISE = "Everything your AI agents need to become real software.";
var PILLAR_COPY = {
  identity: {
    title: "Agent identity",
    body: "Personas, teams, and registries give your agents durable, versioned identities \u2014 minds you can build, publish, and trust."
  },
  backend: {
    title: "The agentic backend",
    body: "Storage, auth, customers, billing, and every other platform service agent-built software needs to run for real users."
  },
  build: {
    title: "Build with agents",
    body: "Toolkits, recipes, and agentic dev teams that turn an idea into shipped software \u2014 with agents doing the work."
  }
};
var STAGE_LABEL = {
  discover: "Discover",
  learn: "Learn",
  build: "Build",
  ship: "Ship",
  adopt: "Adopt"
};

// src/marketing/StorySections.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var ALL_PILLARS = Object.keys(PILLAR_COPY);
function StorySections({ siteId }) {
  const story = getSiteStory(siteId);
  const node = siteConcept(siteId);
  const pillar = PILLAR_COPY[story.pillar];
  const next = getSite(story.nextStep);
  return /* @__PURE__ */ jsxs2("section", { className: "adh-story", "aria-label": "The Agentic Developer story", children: [
    node?.keyPoints?.length ? /* @__PURE__ */ jsxs2("div", { className: "adh-story__section", children: [
      /* @__PURE__ */ jsx2("h2", { className: "adh-story__heading", children: "What you can do here" }),
      /* @__PURE__ */ jsx2("ul", { className: "adh-story__points", children: node.keyPoints.map((point) => /* @__PURE__ */ jsx2("li", { children: point }, point)) })
    ] }) : null,
    /* @__PURE__ */ jsxs2("div", { className: "adh-story__section", children: [
      /* @__PURE__ */ jsxs2("p", { className: "adh-story__eyebrow", children: [
        STAGE_LABEL[story.funnelStage],
        " \xB7 The Agentic Developer story"
      ] }),
      /* @__PURE__ */ jsx2("p", { className: "adh-story__promise", children: BRAND_PROMISE }),
      story.tier === "masterbrand" ? (
        // The masterbrand carries the whole promise: all three pillars.
        /* @__PURE__ */ jsx2("div", { className: "adh-story__pillars", children: ALL_PILLARS.map((key) => /* @__PURE__ */ jsxs2("div", { className: "adh-story__pillar-card", children: [
          /* @__PURE__ */ jsx2("h2", { className: "adh-story__heading", children: PILLAR_COPY[key].title }),
          /* @__PURE__ */ jsx2("p", { className: "adh-story__body", children: PILLAR_COPY[key].body })
        ] }, key)) })
      ) : /* @__PURE__ */ jsxs2(Fragment, { children: [
        /* @__PURE__ */ jsx2("h2", { className: "adh-story__heading", children: pillar.title }),
        /* @__PURE__ */ jsx2("p", { className: "adh-story__body", children: pillar.body })
      ] }),
      story.tier === "satellite" ? (
        // Endorsed satellites: own identity, visible provenance (From/Of rule).
        /* @__PURE__ */ jsx2("p", { className: "adh-story__provenance", children: "From the Agentic Developer Hub" })
      ) : null
    ] }),
    next ? /* @__PURE__ */ jsxs2("div", { className: "adh-story__section", children: [
      /* @__PURE__ */ jsx2("p", { className: "adh-story__eyebrow", children: "Next in the story" }),
      /* @__PURE__ */ jsxs2("a", { className: "adh-story__next", href: siteProdUrl(next.id, "/"), children: [
        /* @__PURE__ */ jsx2("span", { className: "adh-story__next-name", children: siteHeaderTitle(next) }),
        next.description ? /* @__PURE__ */ jsx2("span", { className: "adh-story__next-desc", children: next.description }) : null,
        /* @__PURE__ */ jsx2("span", { className: "adh-story__next-arrow", "aria-hidden": "true", children: "\u2192" })
      ] })
    ] }) : null
  ] });
}

// src/marketing/MarketingLanding.tsx
import { Fragment as Fragment2, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var GRAPH_ENVS = /* @__PURE__ */ new Set(["local", "testing", "staging"]);
function MarketingLanding({ siteId, focusId }) {
  const node = siteConcept2(siteId);
  const site = getSite2(siteId);
  const { titleLead, titleAccent } = site ? splitSiteTitle(site) : { titleLead: "", titleAccent: node?.label ?? "Agentic Developer" };
  const staticHero = /* @__PURE__ */ jsx3(
    SiteLanding,
    {
      eyebrow: node?.kicker ?? "",
      titleLead,
      titleAccent,
      blurb: node?.blurb ?? ""
    }
  );
  const hero = GRAPH_ENVS.has(process.env.DEPLOYMENT_ENV ?? "") ? /* @__PURE__ */ jsx3(
    LandingHeroGate,
    {
      diagram: /* @__PURE__ */ jsx3(LandingGraph, { siteId, focusId }),
      fallback: staticHero
    }
  ) : staticHero;
  return /* @__PURE__ */ jsxs3(Fragment2, { children: [
    hero,
    /* @__PURE__ */ jsx3(StorySections, { siteId })
  ] });
}

// src/marketing/index.ts
import { MarketingSiteHeader as MarketingSiteHeader2 } from "@agentic-toolkit/adh/marketing/MarketingSiteHeader";

// src/marketing/MarketingRootHtml.tsx
import { Fragment as Fragment3 } from "react";
import { AdhThemeStyle } from "@agentic-toolkit/adh/server";
import { AppShell } from "@agentic-toolkit/adh/layout";
import { getLocale, htmlLang, localeDir } from "@agentic-toolkit/adh/concepts";
import { AuthProvider } from "@agentic-toolkit/adh/auth";
import { MarketingSiteHeader } from "@agentic-toolkit/adh/marketing/MarketingSiteHeader";
import {
  HelpContentProvider
} from "@agenticdevelopertoolkit/ui/components/help-content";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function MarketingRootHtml({
  siteId,
  navLinks,
  trailingNavLinks,
  footerLinks,
  silentSso = true,
  header,
  providers,
  help,
  children
}) {
  const loc = getLocale();
  const SiteProviders = providers ?? Fragment3;
  return (
    // suppressHydrationWarning: AdhThemeStyle's appearance pre-paint script sets class/data-*
    // on <html> before hydration (the user's colour mode), so the client tree legitimately
    // differs from the server's here. Same contract next-themes has.
    /* @__PURE__ */ jsxs4("html", { lang: htmlLang(loc), dir: localeDir(loc), suppressHydrationWarning: true, children: [
      /* @__PURE__ */ jsx4("head", { children: /* @__PURE__ */ jsx4(AdhThemeStyle, {}) }),
      /* @__PURE__ */ jsx4("body", { children: /* @__PURE__ */ jsx4(HelpContentProvider, { help: help ?? {}, children: /* @__PURE__ */ jsx4(AuthProvider, { clientId: "adh", storageKey: "auth_tokens", silentSso, children: /* @__PURE__ */ jsx4(SiteProviders, { children: /* @__PURE__ */ jsx4(
        AppShell,
        {
          header: header ?? /* @__PURE__ */ jsx4(
            MarketingSiteHeader,
            {
              siteId,
              navLinks,
              trailingNavLinks
            }
          ),
          footer: { links: footerLinks ?? [] },
          children
        }
      ) }) }) }) })
    ] })
  );
}
export {
  BRAND_PROMISE,
  MarketingLanding,
  MarketingRootHtml,
  MarketingSiteHeader2 as MarketingSiteHeader,
  PILLAR_COPY,
  STAGE_LABEL,
  StorySections
};
//# sourceMappingURL=index.js.map