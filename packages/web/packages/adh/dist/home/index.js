'use client'

"use client";

// src/home/SiteHomeRoute.tsx
import "react";
import { useParams } from "next/navigation";

// src/home/SiteHomeShell.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { TopicSelectHint } from "@agentic-toolkit/ui/blocks";
import {
  useResourceList,
  workspacesApi,
  workspacePrefsApi,
  readCachedWorkspace,
  writeCachedWorkspace
} from "@agentic-toolkit/data";
import { useHeaderCenter, useHeaderCenterProvided } from "@agentic-toolkit/adh/header/HeaderCenter";

// src/home/WorkspacePicker.tsx
import "react";
import { ChevronDown } from "lucide-react";
import { PopupMenu } from "@agentic-toolkit/ui/blocks";
import { jsx } from "react/jsx-runtime";
function WorkspacePicker({
  workspaces,
  selected,
  onSelect,
  className
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
      className
    }
  );
}

// src/home/SiteHomeShell.tsx
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
var loadWorkspaces = () => workspacesApi.list();
function SiteHomeShell({
  basePath,
  workspaceSlug,
  children
}) {
  const router = useRouter();
  const { items: workspaces } = useResourceList(
    `${basePath}::workspaces`,
    loadWorkspaces
  );
  const centerEl = useHeaderCenter();
  const headerCenterProvided = useHeaderCenterProvided();
  useEffect(() => {
    if (!headerCenterProvided) {
      console.warn(
        "[SiteHomeShell] No HeaderCenterProvider found above this component \u2014 mount one (see AdhAppShell.tsx). Without it, the workspace chooser will not appear above 768px."
      );
    }
  }, [headerCenterProvided]);
  const [stored, setStored] = useState(() => readCachedWorkspace());
  const [prefsSettled, setPrefsSettled] = useState(false);
  const [pendingWrite, setPendingWrite] = useState(() => workspaceSlug ?? null);
  const wroteLocally = useRef(false);
  useEffect(() => {
    let alive = true;
    const bail = setTimeout(() => {
      if (alive) setPrefsSettled(true);
    }, 5e3);
    workspacePrefsApi.get().then((prefs) => {
      if (!alive) return;
      clearTimeout(bail);
      if (prefs.slug && !wroteLocally.current) {
        setStored(prefs.slug);
        writeCachedWorkspace(prefs.slug);
      }
      setPrefsSettled(true);
    }).catch(() => {
      if (alive) {
        clearTimeout(bail);
        setPrefsSettled(true);
      }
    });
    return () => {
      alive = false;
      clearTimeout(bail);
    };
  }, []);
  const resolved = useMemo(() => {
    if (workspaces === null) return void 0;
    const known = (s) => s && workspaces.some((w) => w.slug === s) ? s : null;
    const fromUrl = known(workspaceSlug);
    if (fromUrl) return fromUrl;
    if (!prefsSettled) return void 0;
    return known(stored) ?? workspaces[0]?.slug ?? null;
  }, [workspaces, workspaceSlug, stored, prefsSettled]);
  useEffect(() => {
    if (resolved && resolved !== workspaceSlug) {
      router.replace(`${basePath}/${resolved}`, { scroll: false });
    }
  }, [resolved, workspaceSlug, basePath, router]);
  useEffect(() => {
    if (!resolved || resolved !== workspaceSlug || pendingWrite !== resolved) return;
    if (resolved === stored) return;
    setPendingWrite(null);
    wroteLocally.current = true;
    writeCachedWorkspace(resolved);
    setStored(resolved);
    workspacePrefsApi.put({ slug: resolved }).catch(() => {
    });
  }, [resolved, workspaceSlug, stored, pendingWrite]);
  const onSelect = useCallback(
    (slug) => {
      setPendingWrite(slug);
      router.push(`${basePath}/${slug}`, { scroll: false });
    },
    [basePath, router]
  );
  const picker = /* @__PURE__ */ jsx2(WorkspacePicker, { workspaces, selected: resolved ?? null, onSelect });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    centerEl && createPortal(
      /* @__PURE__ */ jsx2("div", { className: "adh-home__header-picker", children: /* @__PURE__ */ jsx2(
        WorkspacePicker,
        {
          workspaces,
          selected: resolved ?? null,
          onSelect,
          className: "w-auto max-w-full"
        }
      ) }),
      centerEl
    ),
    /* @__PURE__ */ jsx2("div", { className: "adh-home__toolbar", children: picker }),
    resolved === null && /* @__PURE__ */ jsx2(TopicSelectHint, { title: "No workspaces yet \u2014 create one from the hub to get started." }),
    resolved !== void 0 && resolved !== null && resolved === workspaceSlug && children({ workspaceSlug: resolved, scopedBase: `${basePath}/${resolved}` })
  ] });
}

// src/home/SiteHomeRoute.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
function SiteHomeRoute({ model }) {
  const raw = useParams()?.path;
  const segments = raw === void 0 ? [] : Array.isArray(raw) ? raw : [raw];
  const [workspaceSlug, ...rest] = segments;
  return /* @__PURE__ */ jsx3(SiteHomeShell, { basePath: model.basePath, workspaceSlug, children: (scope) => model.render({ ...scope, view: model.parse(rest) }) });
}

// src/home/SiteHomeModel.ts
function defineSiteHome(model) {
  return model;
}
export {
  SiteHomeRoute,
  SiteHomeShell,
  WorkspacePicker,
  defineSiteHome
};
//# sourceMappingURL=index.js.map