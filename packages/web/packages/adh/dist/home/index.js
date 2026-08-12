'use client'

"use client";

// src/home/SiteHomeRoute.tsx
import "react";
import { useParams } from "next/navigation";

// src/home/SiteHomeShell.tsx
import { useCallback as useCallback2 } from "react";
import { notFound, usePathname } from "next/navigation";
import { TopicSelectHint } from "@agentic-toolkit/ui/blocks";
import { useResourceList, workspacesApi } from "@agentic-toolkit/data";

// src/home/WorkspaceBar.tsx
import "react";

// src/home/WorkspacePicker.tsx
import "react";
import { ChevronDown } from "lucide-react";
import { PopupMenu } from "@agentic-toolkit/ui/blocks";
import { jsx } from "react/jsx-runtime";
function WorkspacePicker({
  workspaces,
  selected,
  onSelect
}) {
  const allLabel = workspaces === null ? "Loading\u2026" : workspaces.length === 0 ? "No workspaces" : selected === null ? "Loading\u2026" : null;
  return /* @__PURE__ */ jsx(
    PopupMenu,
    {
      items: (workspaces ?? []).map((w) => ({ id: w.slug, label: w.name })),
      selectedId: selected,
      onSelect: (id) => {
        if (id) onSelect(id);
      },
      allLabel,
      ariaLabel: "Workspace",
      icon: /* @__PURE__ */ jsx(ChevronDown, { size: 14, "aria-hidden": true, className: "shrink-0 text-apt-text-muted" }),
      className: "w-auto max-w-full"
    }
  );
}

// src/home/WorkspaceBar.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function WorkspaceBar({
  workspaces,
  selected,
  onSelect,
  action
}) {
  return (
    // Three tracks, not a flex row: the label+picker group sits in the middle one so it is centred
    // on the BAR, not merely centred in what the action leaves over. A flex row can't do this —
    // the hub's action is `ml-auto`, so the group it pushes right of centre is off-centre by
    // exactly the action's width, and a site that passes no action would centre it differently
    // again. The empty first and third tracks are what make the two cases identical.
    /* @__PURE__ */ jsxs("div", { className: "adh-home__toolbar", children: [
      /* @__PURE__ */ jsxs("div", { className: "adh-home__toolbar-control", children: [
        /* @__PURE__ */ jsx2("span", { className: "adh-home__toolbar-label", "aria-hidden": true, children: "Workspace" }),
        /* @__PURE__ */ jsx2(WorkspacePicker, { workspaces, selected, onSelect })
      ] }),
      action
    ] })
  );
}

// src/home/useWorkspaceRoute.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useResourceItemQuery,
  useResourceItemWriter,
  workspacePrefsApi,
  readCachedWorkspace,
  writeCachedWorkspace
} from "@agentic-toolkit/data";
var PREFS_CACHE_KEY = "workspace-prefs";
var PREFS_ID = "me";
var loadPrefs = () => workspacePrefsApi.get();
var seededByUs = null;
var SEED_HANDOFF_MS = 1e4;
function withUrlExtras(href) {
  if (typeof window === "undefined") return href;
  if (href.includes("?") || href.includes("#")) return href;
  return href + window.location.search + window.location.hash;
}
function useWorkspaceRoute({
  workspaces,
  workspaceSlug,
  hrefFor,
  switchHrefFor,
  canPersist
}) {
  const router = useRouter();
  const [stored, setStored] = useState(() => readCachedWorkspace());
  const { item: prefs, error: prefsError } = useResourceItemQuery(
    PREFS_CACHE_KEY,
    PREFS_ID,
    loadPrefs
  );
  const writePrefs = useResourceItemWriter(PREFS_CACHE_KEY);
  const settledByRead = prefs !== null || prefsError !== null;
  const [bailed, setBailed] = useState(false);
  useEffect(() => {
    if (settledByRead) return;
    const bail = setTimeout(() => setBailed(true), 5e3);
    return () => clearTimeout(bail);
  }, [settledByRead]);
  const prefsSettled = settledByRead || bailed;
  const arrivedOnOwnGuess = useRef(
    workspaceSlug !== void 0 && seededByUs !== null && workspaceSlug === seededByUs.slug && Date.now() - seededByUs.at <= SEED_HANDOFF_MS
  );
  const [pendingWrite, setPendingWrite] = useState(
    () => arrivedOnOwnGuess.current ? null : workspaceSlug ?? null
  );
  useEffect(() => {
    seededByUs = null;
  }, []);
  const [wroteLocally, setWroteLocally] = useState(false);
  const preference = wroteLocally ? stored : prefs?.slug ?? stored;
  useEffect(() => {
    if (prefs?.slug && !wroteLocally) writeCachedWorkspace(prefs.slug);
  }, [prefs, wroteLocally]);
  const resolved = useMemo(() => {
    if (workspaces === null) return void 0;
    const known = (s) => s && workspaces.some((w) => w.slug === s) ? s : null;
    const fromUrl = known(workspaceSlug);
    if (fromUrl) return fromUrl;
    if (workspaceSlug !== void 0) return void 0;
    if (!prefsSettled) return void 0;
    return known(preference) ?? workspaces[0]?.slug ?? null;
  }, [workspaces, workspaceSlug, preference, prefsSettled]);
  useEffect(() => {
    if (resolved && resolved !== workspaceSlug) {
      seededByUs = { slug: resolved, at: Date.now() };
      router.replace(withUrlExtras(hrefFor(resolved)), { scroll: false });
    }
  }, [resolved, workspaceSlug, hrefFor, router]);
  useEffect(() => {
    if (!resolved || resolved !== workspaceSlug || pendingWrite !== resolved) return;
    if (resolved === preference) return;
    setPendingWrite(null);
    if (canPersist && !canPersist(resolved)) return;
    setWroteLocally(true);
    writeCachedWorkspace(resolved);
    setStored(resolved);
    writePrefs(PREFS_ID, { slug: resolved });
    workspacePrefsApi.put({ slug: resolved }).catch(() => {
    });
  }, [resolved, workspaceSlug, preference, pendingWrite, canPersist, writePrefs]);
  const onSelect = useCallback(
    (slug) => {
      seededByUs = null;
      setPendingWrite(slug);
      router.push((switchHrefFor ?? hrefFor)(slug), { scroll: false });
    },
    [hrefFor, switchHrefFor, router]
  );
  return { resolved, onSelect };
}

// src/home/workspacePathTail.ts
function workspacePathTail(pathname) {
  return pathname.split("/").filter(Boolean).slice(1);
}

// src/home/SiteHomeShell.tsx
import { Fragment, jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var loadWorkspaces = () => workspacesApi.list();
function SiteHomeShell({ workspaceSlug, children }) {
  const { items: workspaces, error, isFetching } = useResourceList(
    "workspaces",
    loadWorkspaces
  );
  const hrefFor = useCallback2((slug) => `/${slug}`, []);
  const pathname = usePathname() ?? "";
  const switchHrefFor = useCallback2(
    (slug) => `/${[slug, ...workspacePathTail(pathname)].join("/")}`,
    [pathname]
  );
  const { resolved, onSelect } = useWorkspaceRoute({
    workspaces,
    workspaceSlug,
    hrefFor,
    switchHrefFor
  });
  const workspace = workspaces?.find((w) => w.slug === resolved) ?? null;
  if (workspaceSlug !== void 0 && workspaces !== null && !isFetching && !workspaces.some((w) => w.slug === workspaceSlug)) {
    notFound();
  }
  return /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx3(WorkspaceBar, { workspaces, selected: resolved ?? null, onSelect }),
    error !== null && workspaces === null && /* @__PURE__ */ jsx3(TopicSelectHint, { title: "Couldn't load your workspaces. Reload the page to try again." }),
    resolved === null && /* @__PURE__ */ jsx3(TopicSelectHint, { title: "No workspaces yet \u2014 create one from the hub to get started." }),
    resolved !== void 0 && resolved !== null && resolved === workspaceSlug && workspace !== null && children({
      workspaceSlug: resolved,
      scopedBase: `/${resolved}`,
      workspace
    })
  ] });
}

// src/home/SiteHomeRoute.tsx
import { jsx as jsx4 } from "react/jsx-runtime";
function SiteHomeRoute({ model }) {
  const params = useParams();
  const raw = params?.path;
  const rest = raw === void 0 ? [] : Array.isArray(raw) ? raw : [raw];
  const workspaceSlug = params?.workspace;
  const view = model.parse(rest);
  const Shell = model.shell ?? SiteHomeShell;
  return /* @__PURE__ */ jsx4(Shell, { workspaceSlug, children: (scope) => model.render({ ...scope, view }) });
}

// src/home/SiteHomeModel.ts
import { notFound as notFound2 } from "next/navigation";
function defineSiteHome(model) {
  return model;
}
function noSubPath(segments) {
  if (segments.length > 0) notFound2();
  return null;
}
export {
  SiteHomeRoute,
  SiteHomeShell,
  WorkspaceBar,
  WorkspacePicker,
  defineSiteHome,
  noSubPath,
  useWorkspaceRoute,
  workspacePathTail
};
//# sourceMappingURL=index.js.map