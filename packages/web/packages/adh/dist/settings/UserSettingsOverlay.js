"use client";

"use client";

// src/settings/UserSettingsOverlay.tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle
} from "@agentic-toolkit/ui/components/dialog";
import { UnsavedChangesAlert } from "@agentic-toolkit/ui/components/unsaved-changes-alert";
import { SettingsLayout as SettingsLayout2 } from "@agentic-toolkit/account";
import { SettingsDirtyProvider as SettingsDirtyProvider2, useSettingsDirty } from "@agentic-toolkit/resource";
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";

// src/settings/registry.tsx
import {
  User,
  CreditCard,
  Gauge,
  Globe,
  Palette,
  Share2,
  MapPin,
  Mail,
  Key,
  Bell,
  Shield,
  Bot,
  Archive
} from "lucide-react";
import {
  AccountPanel,
  ArchivedPanel,
  ContactInfoPanel,
  NotificationsWorkspace,
  ProfilePanel,
  SecurityWorkspace,
  SettingsLayout,
  SubscriptionPanel
} from "@agentic-toolkit/account";
import { UsagePanel, SocialLinksPanel, AddressesPanel } from "@agentic-toolkit/profile";
import { TokensPanel } from "@agentic-toolkit/authentication";
import { AssistantsPanel } from "@agentic-toolkit/personas";
import { FeatureTitle, SettingsDirtyProvider } from "@agentic-toolkit/resource";
import { RecordApiButton } from "@agentic-toolkit/api-explorer";

// src/site/reservedSlugs.ts
var FAMILY_ROUTE_SEGMENTS = [
  "auth",
  // app/auth — the SSO callback
  "home",
  // app/home — the workspace-resolving redirect
  "details",
  // app/details/[topic] — the shared concept pages
  "privacy",
  "terms",
  "tour",
  // the landing deck's second route
  // Not a directory on any site: `marketingNextConfig` rewrites `/api/*` to the backend, so
  // the segment is spoken for on all 42 without appearing in any `app/` tree.
  "api",
  // Next serves these from FILES at the root of `app/`, so they occupy the same segment as a
  // slug even though no directory names them.
  "favicon.ico",
  "icon.svg",
  "apple-icon.png",
  "opengraph-image.png",
  "robots.txt",
  "sitemap.xml",
  // The framework's own namespace.
  "_next"
];
var SITE_ROUTE_SEGMENTS = [
  // community — app/{categories,discussions,forum,people,topics}. (`admin` is below.) `forum` is
  // the board: it was this site's `/home` until `/home` became the family's workspace redirect,
  // and it is the one segment the convergence itself minted.
  "categories",
  "discussions",
  "forum",
  "people",
  "topics",
  // consultants — app/consultant/[entry], the public profile of one directory entry. The site is
  // named in the plural and the route in the singular, so the reserved word is the one the URL
  // spends, not the one on the tin.
  "consultant",
  // cookbook — the corpus IS these nine words. Each is a real directory,
  // `app/(reader)/<section>/[[...slug]]`, so `/guidelines/testing/test-pyramid` is a document's
  // own address with nothing in front of it; the route group contributes no segment. They are
  // reserved because a static segment beats `[workspace]`, not because a redirect claims them —
  // there is no `/docs` prefix any more, and the entry in RESERVED_HANDLE_WORDS below is taste,
  // not this site. `projects` is cookbook's ninth section directory as well as the hub's
  // feature-page redirect, and is listed once, under the hub. This is the cost recorded in that
  // site's `.claude/rules/site-design.md` — adding a section to the book adds a reserved slug
  // for the whole family.
  "introduction",
  "principles",
  "guidelines",
  "ingredients",
  "recipes",
  "compliance",
  "reference",
  "appendix",
  // hub — app/{features,integrations,old-landing}, app/(auth)/{join,oidc}, app/(hub)/explore.
  // (`login`, `signup`, `contact`, `settings` and `user` are below.) `old-landing` is the
  // superseded hero page, still routable and deliberately kept so, which makes it a segment
  // like any other. `features` is where the eight marketing pages moved to when the root
  // segment became `[workspace]`, and it is a real directory: `app/features/[id]/`. The
  // integrations SITE routes `integrations` too — `app/integrations/oauth-callback`, where a
  // provider's OAuth redirect lands, at a path `oauthCallbackUrl()` builds from the window's own
  // origin and so cannot vary per site. Every site that mounts that feature grows the same
  // directory; the word is listed once.
  "features",
  "integrations",
  "join",
  "oidc",
  "explore",
  "old-landing",
  // hub — the marketing feature pages. These are not directories either: they were served
  // by `app/[slug]/page.tsx`, which dispatched on the slug ahead of a user profile, and the
  // root segment is `[workspace]` now — so each is a permanent REDIRECT source in the hub's
  // `next.config.ts` (`/<id>` → `/features/<id>`), derived from the same list the route's
  // generateStaticParams reads. A redirect answers before any route does, so the segment is
  // spoken for exactly as a directory's is, and these stay here rather than moving down to
  // RESERVED_HANDLE_WORDS: they are addressable URLs, not merely words a handle may not take.
  "agentic-personas",
  "persona-data-store",
  "user-data-store",
  "status-pages",
  "rest-api",
  "mcp",
  "applications",
  "projects",
  // personaregistry — `org` and `persona`, both REDIRECT sources in that site's `next.config.ts`
  // for the same reason the hub's eight above are: a redirect source claims its segment as
  // surely as a directory does. Neither is a directory there any more. `app/persona/[slug]`
  // existed only while the family's `[workspace]` sat at that site's root; `app/org/[slug]` was
  // older and outlived that window. Personas, users and organizations all address off the ROOT
  // now (`app/[slug]`) — an org is shown the way a user is, so it needs no prefix — and the old
  // prefixes stayed behind pointing at it. (`user` is the hub's public profile prefix, listed
  // above, and is a redirect source on this site too.)
  "org",
  "persona",
  // registries — app/registry/[registry] and app/registry/[registry]/[entry]: one owner-built
  // directory, and one entry within it. Singular for the same reason `consultant` is.
  "registry",
  // research — app/{papers,search}.
  "papers",
  "search",
  // toolkit — app/demo.
  "demo"
];
var GRAMMAR_SEGMENTS = [
  // organizations, teams, projects, ecosystems — `parse-path.ts`, the "all" landing.
  "all"
];
var RESERVED_HANDLE_WORDS = [
  "about",
  "admin",
  "assets",
  "billing",
  "blog",
  "contact",
  "dashboard",
  "docs",
  "help",
  "legal",
  "login",
  "logout",
  "me",
  "monitoring",
  "pricing",
  "profile",
  "public",
  "register",
  "session",
  "sessions",
  "settings",
  "signin",
  "signout",
  "signup",
  "static",
  "status",
  "support",
  "user",
  "users",
  // The hub's feature vocabulary. Every one of these is a SECOND segment — `/<workspace>/teams`,
  // `/<workspace>/tokens` — so none of them shadows a slug, and that is why they sit here rather
  // than in SITE_ROUTE_SEGMENTS. The hub refused them anyway, on the grounds that a profile slug
  // reading as one of its own feature words is a URL nobody can parse at a glance, and that
  // judgement is kept. The first group mirrors `FEATURES` in the hub's `data/feature-routes.ts`;
  // the rest are rail routes listed outside it, plus the two RETIRED segments — `ecosystems`,
  // which Products replaced, and `communities`, whose hub route rendered "Coming soon" until
  // agenticdevelopercommunities.com took the topic over. Both are held back so a stale link
  // resolves predictably instead of landing on whichever user claimed the handle.
  "all-data",
  "communities",
  "dashboards",
  "ecosystems",
  "email-signup",
  "feature-flags",
  "gamification",
  "invitations",
  "knowledgebases",
  "llm-providers",
  "members",
  "messaging",
  "narratives",
  "persona-services",
  "personas",
  "products",
  "registries",
  "research",
  "server-bags",
  "signin-apps",
  "storage",
  "teams",
  "tokens"
];
function reservedWorkspaceSlugs() {
  const all = [
    ...FAMILY_ROUTE_SEGMENTS,
    ...SITE_ROUTE_SEGMENTS,
    ...GRAMMAR_SEGMENTS,
    ...RESERVED_HANDLE_WORDS
  ];
  return new Set(all.map((s) => s.toLowerCase()));
}

// src/site/index.ts
import { isHubWorkspacePath, hubWorkspaceSlug } from "@agentic-toolkit/adh/site/hubWorkspacePath";

// src/settings/AppearancePanel.tsx
import dynamic from "next/dynamic";
import "react";
import "@agentic-toolkit/themes";
import { useAppearanceSettings } from "@agentic-toolkit/adh/auth";
import {
  ToggleGroup,
  ToggleGroupItem
} from "@agentic-toolkit/ui/components/toggle-group";
import { Checkbox } from "@agentic-toolkit/ui/components/checkbox";
import { Label } from "@agentic-toolkit/ui/components/label";
import { SettingRow } from "@agentic-toolkit/account";
import { jsx, jsxs } from "react/jsx-runtime";
var REDUCE_MOTION_OPTIONS = [
  { value: "auto", label: "Default" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" }
];
var CONTRAST_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "high", label: "High" },
  { value: "extra-high", label: "Extra High" }
];
var TEXT_SIZE_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "small", label: "Small" },
  { value: "large", label: "Large" },
  { value: "extra-large", label: "Extra Large" }
];
var SPACING_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" }
];
function SegmentedRow({
  label,
  description,
  value,
  options,
  onChange,
  iconsOnly
}) {
  return /* @__PURE__ */ jsx(SettingRow, { label, description, children: /* @__PURE__ */ jsx(
    ToggleGroup,
    {
      "aria-label": label,
      value: [value],
      onValueChange: (next) => {
        const v = next[0];
        if (v) onChange(v);
      },
      children: options.map((o) => /* @__PURE__ */ jsxs(
        ToggleGroupItem,
        {
          value: o.value,
          "aria-label": iconsOnly ? o.label : void 0,
          title: iconsOnly ? o.label : void 0,
          children: [
            o.icon,
            !iconsOnly && o.label
          ]
        },
        o.value
      ))
    }
  ) });
}
function CheckboxRow({
  id,
  label,
  description,
  checked,
  onCheckedChange
}) {
  return /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
    /* @__PURE__ */ jsx(Checkbox, { id, checked, onCheckedChange, className: "mt-0.5" }),
    /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsx(Label, { htmlFor: id, className: "cursor-pointer", children: label }),
      description && /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-xs text-apt-text-muted", children: description })
    ] })
  ] });
}
var ThemePickerRow = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "local" || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "testing" || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "staging" ? dynamic(() => import("@agentic-toolkit/adh/settings/ThemePickerRow"), { ssr: false }) : () => null;
function AppearancePanel() {
  const { prefs, set } = useAppearanceSettings();
  return /* @__PURE__ */ jsx("div", { className: "min-h-0 flex-1 overflow-y-auto px-6 py-6", children: /* @__PURE__ */ jsxs("div", { className: "max-w-3xl space-y-7", children: [
    /* @__PURE__ */ jsx("p", { className: "text-sm text-apt-text-muted", children: "\u201CDefault\u201D follows your device\u2019s own setting where possible. These preferences are saved to your account, so they follow you to every site in the family." }),
    /* @__PURE__ */ jsx(ThemePickerRow, {}),
    /* @__PURE__ */ jsx(
      SegmentedRow,
      {
        label: "Reduce motion",
        description: "Minimise animations and transitions.",
        value: prefs.reduceMotion,
        options: REDUCE_MOTION_OPTIONS,
        onChange: (reduceMotion) => set({ reduceMotion })
      }
    ),
    /* @__PURE__ */ jsx(
      SegmentedRow,
      {
        label: "Contrast",
        description: "Strengthen text and border contrast.",
        value: prefs.contrast,
        options: CONTRAST_OPTIONS,
        onChange: (contrast) => set({ contrast })
      }
    ),
    /* @__PURE__ */ jsx(
      SegmentedRow,
      {
        label: "Text size",
        value: prefs.textSize,
        options: TEXT_SIZE_OPTIONS,
        onChange: (textSize) => set({ textSize })
      }
    ),
    /* @__PURE__ */ jsx(
      SegmentedRow,
      {
        label: "Spacing",
        description: "Density of layout spacing.",
        value: prefs.spacing,
        options: SPACING_OPTIONS,
        onChange: (spacing) => set({ spacing })
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "space-y-4 border-t border-apt-border pt-6", children: [
      /* @__PURE__ */ jsx(
        CheckboxRow,
        {
          id: "appearance-focus-outlines",
          label: "Always show focus outlines",
          description: "Show the focus ring even when navigating with a mouse.",
          checked: prefs.focusOutlines,
          onCheckedChange: (focusOutlines) => set({ focusOutlines })
        }
      ),
      /* @__PURE__ */ jsx(
        CheckboxRow,
        {
          id: "appearance-underline-links",
          label: "Always underline links",
          checked: prefs.underlineLinks,
          onCheckedChange: (underlineLinks) => set({ underlineLinks })
        }
      )
    ] })
  ] }) });
}

// src/settings/registry.tsx
import {
  SETTINGS_TOPICS,
  resolveSettingsTopic
} from "@agentic-toolkit/adh/settings/topics";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var ICONS = {
  account: /* @__PURE__ */ jsx2(User, { size: 16, "aria-hidden": true }),
  security: /* @__PURE__ */ jsx2(Shield, { size: 16, "aria-hidden": true }),
  subscription: /* @__PURE__ */ jsx2(CreditCard, { size: 16, "aria-hidden": true }),
  usage: /* @__PURE__ */ jsx2(Gauge, { size: 16, "aria-hidden": true }),
  profile: /* @__PURE__ */ jsx2(Globe, { size: 16, "aria-hidden": true }),
  appearance: /* @__PURE__ */ jsx2(Palette, { size: 16, "aria-hidden": true }),
  social: /* @__PURE__ */ jsx2(Share2, { size: 16, "aria-hidden": true }),
  addresses: /* @__PURE__ */ jsx2(MapPin, { size: 16, "aria-hidden": true }),
  contacts: /* @__PURE__ */ jsx2(Mail, { size: 16, "aria-hidden": true }),
  notifications: /* @__PURE__ */ jsx2(Bell, { size: 16, "aria-hidden": true }),
  tokens: /* @__PURE__ */ jsx2(Key, { size: 16, "aria-hidden": true }),
  assistants: /* @__PURE__ */ jsx2(Bot, { size: 16, "aria-hidden": true }),
  archived: /* @__PURE__ */ jsx2(Archive, { size: 16, "aria-hidden": true })
};
var HELP = {
  account: "Your sign-in email and password.",
  subscription: "Your plan and billing.",
  usage: "This period\u2019s calls, data, tokens and spend, per principal.",
  profile: "Your public display name and profile URL.",
  appearance: "Theme, motion, contrast, text size, and spacing.",
  social: "Links to your public profiles on other platforms.",
  addresses: "Physical addresses shown on your card.",
  contacts: "Emails and phone numbers shown on your card.",
  tokens: "Create and revoke personal API tokens.",
  assistants: "Control, per tool, what each assistant may do on your behalf.",
  archived: "Organizations you've archived. Restore one while its handle is still free."
};
var PANELS = {
  account: /* @__PURE__ */ jsx2(AccountPanel, {}),
  security: /* @__PURE__ */ jsx2(SecurityWorkspace, {}),
  subscription: /* @__PURE__ */ jsx2(SubscriptionPanel, {}),
  usage: /* @__PURE__ */ jsx2(UsagePanel, {}),
  profile: /* @__PURE__ */ jsx2(ProfilePanel, { reservedSlugs: reservedWorkspaceSlugs() }),
  appearance: /* @__PURE__ */ jsx2(AppearancePanel, {}),
  social: /* @__PURE__ */ jsx2(SocialLinksPanel, {}),
  addresses: /* @__PURE__ */ jsx2(AddressesPanel, {}),
  contacts: /* @__PURE__ */ jsx2(ContactInfoPanel, {}),
  notifications: /* @__PURE__ */ jsx2(NotificationsWorkspace, {}),
  tokens: /* @__PURE__ */ jsx2(TokensPanel, {}),
  assistants: /* @__PURE__ */ jsx2(AssistantsPanel, {}),
  archived: /* @__PURE__ */ jsx2(ArchivedPanel, {})
};
var SELF_TITLED = /* @__PURE__ */ new Set([
  "notifications",
  "security"
]);
var API_PATHS = {
  account: "/auth/me",
  usage: "/usage/summary",
  profile: "/auth/me",
  social: "/content/social-links",
  addresses: "/content/addresses",
  contacts: "/account/contacts",
  tokens: "/auth/tokens",
  assistants: "/access/personas/user-actable",
  archived: "/workspaces/archived"
};
function buildSettingsTopics() {
  return SETTINGS_TOPICS.map((t) => {
    const apiPath = API_PATHS[t.id];
    return {
      id: t.id,
      label: t.label,
      icon: ICONS[t.id],
      // Inert in the overlay: SettingsLayout's nav rows are <button>s, and controlled
      // mode (onNavigate, which UserSettingsOverlay always supplies) returns before
      // router.push ever runs — see SettingsLayout.tsx. Live only on hub's /settings
      // route, which renders this same list uncontrolled. Do not "fix" it to match the
      // overlay's actual URL; there isn't one.
      href: `/settings/${t.id}`,
      content: /* @__PURE__ */ jsxs2("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col", children: [
        !SELF_TITLED.has(t.id) && /* @__PURE__ */ jsx2(
          FeatureTitle,
          {
            title: t.label,
            help: HELP[t.id],
            trailing: apiPath ? /* @__PURE__ */ jsx2(RecordApiButton, { path: apiPath, pathValues: {}, title: `${t.label} API` }) : void 0
          }
        ),
        PANELS[t.id]
      ] })
    };
  });
}
function SettingsTab({ activeTopic }) {
  return /* @__PURE__ */ jsx2(SettingsDirtyProvider, { children: /* @__PURE__ */ jsx2(
    SettingsLayout,
    {
      topics: buildSettingsTopics(),
      activeId: resolveSettingsTopic(activeTopic)
    }
  ) });
}

// src/settings/UserSettingsOverlay.tsx
import { DEFAULT_SETTINGS_TOPIC } from "@agentic-toolkit/adh/settings/topics";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function UserSettingsOverlay({
  open,
  onOpenChange
}) {
  return /* @__PURE__ */ jsx3(ToolkitQueryProvider, { children: /* @__PURE__ */ jsx3(SettingsDirtyProvider2, { children: /* @__PURE__ */ jsx3(UserSettingsDialog, { open, onOpenChange }) }) });
}
function UserSettingsDialog({
  open,
  onOpenChange
}) {
  const [topic, setTopic] = useState(DEFAULT_SETTINGS_TOPIC);
  const [openedWith, setOpenedWith] = useState(open);
  if (open !== openedWith) {
    setOpenedWith(open);
    if (open) setTopic(DEFAULT_SETTINGS_TOPIC);
  }
  const topics = buildSettingsTopics();
  const { isAnyDirty } = useSettingsDirty();
  const [pendingExit, setPendingExit] = useState(null);
  function attemptExit(action) {
    if (isAnyDirty()) setPendingExit(() => action);
    else action();
  }
  function handleOpenChange(next) {
    if (next) {
      onOpenChange(true);
      return;
    }
    attemptExit(() => onOpenChange(false));
  }
  return /* @__PURE__ */ jsx3(Dialog, { open, onOpenChange: handleOpenChange, children: /* @__PURE__ */ jsxs3(
    DialogContent,
    {
      className: "flex flex-col gap-0 overflow-hidden p-0",
      style: {
        width: "min(72rem, calc(100vw - 2rem))",
        maxWidth: "min(72rem, calc(100vw - 2rem))",
        // Tall enough to show all subscription plans without scrolling on a
        // typical desktop; still caps to the viewport on shorter screens.
        height: "min(56rem, calc(100vh - 2rem))",
        maxHeight: "calc(100vh - 2rem)"
      },
      children: [
        /* @__PURE__ */ jsx3(DialogTitle, { className: "shrink-0 border-b border-apt-border px-6 py-3 font-mono text-sm tracking-wide text-apt-gold", children: "User Settings" }),
        /* @__PURE__ */ jsx3("div", { className: "flex min-h-0 flex-1 flex-col", children: /* @__PURE__ */ jsx3(
          SettingsLayout2,
          {
            topics,
            activeId: topic,
            onNavigate: (t) => {
              if (t.id === topic) return;
              attemptExit(() => setTopic(t.id));
            }
          }
        ) }),
        /* @__PURE__ */ jsx3(
          UnsavedChangesAlert,
          {
            open: pendingExit !== null,
            onDiscard: () => {
              pendingExit?.();
              setPendingExit(null);
            },
            onStay: () => setPendingExit(null)
          }
        )
      ]
    }
  ) });
}
export {
  SettingsTab,
  UserSettingsOverlay,
  buildSettingsTopics
};
//# sourceMappingURL=UserSettingsOverlay.js.map