"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LogIn } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import {
  ButtonBar,
  CreateResourceDialog,
  useMasterDetailForm,
  useMasterDetailLevel,
} from "@agentic-toolkit/resource";
import type { TopicLeaf } from "@agentic-toolkit/resource";
import { signinAppsApi, type SigninApp, type SigninAppInput } from "@agentic-toolkit/data/ecosystem-config";
import {
  SigninAppDetail,
  canonicalizeReturnOrigin,
  signinAppBlank,
  signinAppToInput,
  signinAppValidate,
} from "./SigninAppDetail";

// Placeholder auth host for the copy-paste snippet — the developer swaps in their real ADH host.
const AUTH_API_HINT = "https://<your-adh-auth-host>";

function normalizeInput(d: SigninAppInput): SigninAppInput {
  return {
    slug: d.slug.trim().toLowerCase(),
    name: d.name.trim(),
    // Submit each origin in the backend's canonical form so what we send matches what it stores.
    allowedReturnOrigins: d.allowedReturnOrigins.map(canonicalizeReturnOrigin).filter(Boolean),
    githubEnabled: d.githubEnabled,
  };
}

function inputDiffers(a: SigninAppInput, b: SigninAppInput): boolean {
  return (
    a.slug !== b.slug ||
    a.name !== b.name ||
    a.githubEnabled !== b.githubEnabled ||
    JSON.stringify(a.allowedReturnOrigins) !== JSON.stringify(b.allowedReturnOrigins)
  );
}

export function SigninAppsPane({
  ecosystemId,
  help,
  leaf,
}: {
  ecosystemId?: string;
  /** Unused: the breadcrumb names the pane (kept for the ScopedPane prop shape). */
  title?: ReactNode;
  help?: ReactNode;
  /** Deep-linkable client selection (`…/signin-apps/<clientId>`). */
  leaf?: TopicLeaf;
}) {
  const [apps, setApps] = useState<SigninApp[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Creating a sign-in app is a MODAL over the stack, never a blank leaf (HTD recipe
  // `must-create-in-modal`): the `+` opens it, and on save the new app is selected so
  // its REAL detail (GitHub toggle, return origins, connect snippet) opens.
  const [newOpen, setNewOpen] = useState(false);

  // The hub addresses the ecosystem by its rdid (ecosystem.<slug>); derive the slug to preview
  // the composed client id while creating. Empty when the id isn't an rdid.
  const ecoSlug = ecosystemId?.startsWith("ecosystem.")
    ? ecosystemId.slice("ecosystem.".length)
    : "";

  const refresh = useCallback(async () => {
    if (!ecosystemId) return;
    try {
      setLoadError(null);
      setApps(await signinAppsApi.list(ecosystemId));
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "signin-apps-pane", step: "load" });
      // A failed load must not sit on "Loading…" forever: flip out of the loading state.
      setApps([]);
      setLoadError(err instanceof Error ? err.message : "Failed to load sign-in apps.");
    }
  }, [ecosystemId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const urlSelection = leaf ? { selectedId: leaf.leafId, onSelect: leaf.onSelect } : undefined;

  const form = useMasterDetailForm<SigninApp, SigninAppInput>({
    items: apps,
    getId: (a) => a.id,
    urlSelection,
    blank: signinAppBlank,
    toInput: signinAppToInput,
    validate: (draft, others) =>
      signinAppValidate(
        draft,
        others.map((o) => o.slug.slice(o.slug.lastIndexOf(".") + 1)),
      ),
    differs: inputDiffers,
    normalize: normalizeInput,
    create: (input) => signinAppsApi.create(ecosystemId ?? "", input),
    update: (id, input) => signinAppsApi.update(ecosystemId ?? "", id, input),
    remove: (a) => signinAppsApi.delete(ecosystemId ?? "", a.id),
    confirmDelete: (a) => `Delete sign-in app "${a.name}"? Apps using it will stop signing in.`,
    refresh,
    createLabel: "New sign-in app",
  });

  useMasterDetailLevel({
    id: "signin-apps-list",
    title: "Sign-in apps",
    form,
    items: apps,
    getId: (a) => a.id,
    getLabel: (a) => a.name,
    getSublabel: (a) => a.slug,
    // A sign-in app IS a way in — the door icon, not the rail's placeholder circle.
    itemIcon: <LogIn />,
    newLabel: "New sign-in app",
    leaf,
    emptyLabel: loadError
      ? "Couldn't load sign-in apps."
      : apps === null
        ? "Loading…"
        : "No sign-in apps yet.",
    onNew: () => setNewOpen(true),
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {loadError && <p className="px-6 pt-4 text-sm text-apt-red">{loadError}</p>}
      <ButtonBar actions={form.actions} showCreate={false} help={help} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        {form.editing && form.draft ? (
          <SigninAppDetail
            key={form.detailKey}
            title="Sign-in app"
            draft={form.draft}
            onChange={form.onChange}
            error={form.error}
            app={form.selected}
            ecoSlug={ecoSlug}
            authApiHint={AUTH_API_HINT}
          />
        ) : (
          <EmptyState
            title={
              loadError
                ? "Couldn't load sign-in apps."
                : apps === null
                  ? "Loading…"
                  : "Select a sign-in app to edit, or create a new one."
            }
          />
        )}
      </div>

      {/* Create is a scoped modal: name + client id only (the GitHub toggle and return
          origins live in the app's real detail, which opens once it is selected). */}
      {newOpen && (
        <CreateResourceDialog<SigninAppInput, SigninApp>
          ariaLabel="New sign-in app"
          heading="New sign-in app"
          blank={signinAppBlank}
          validate={(d) =>
            signinAppValidate(
              d,
              (apps ?? []).map((a) => a.slug.slice(a.slug.lastIndexOf(".") + 1)),
            )
          }
          create={(d) => signinAppsApi.create(ecosystemId ?? "", normalizeInput(d))}
          onClose={() => setNewOpen(false)}
          onCreated={(app) => {
            setNewOpen(false);
            void refresh();
            if (leaf) leaf.onSelect(app.id);
            else form.select(app.id);
          }}
          renderForm={(draft, onChange, error) => (
            <>
              <Field label="Name">
                <Input
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
                  autoFocus
                  value={draft.name}
                  placeholder="My app"
                  onChange={(e) => onChange({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field
                label="Client id"
                hint="The client id your app sends as clientId. The ecosystem prefix is fixed; only the final name is yours to pick."
              >
                <div className="flex w-full items-center gap-1">
                  {ecoSlug && (
                    <code className="shrink-0 text-sm text-apt-text-muted">{ecoSlug}.</code>
                  )}
                  <Input
                    value={draft.slug}
                    placeholder="my-app"
                    onChange={(e) =>
                      onChange({ ...draft, slug: e.target.value.toLowerCase().replace(/\./g, "") })
                    }
                  />
                </div>
              </Field>
              {error && <p className="text-sm text-apt-red">{error}</p>}
            </>
          )}
        />
      )}
    </div>
  );
}
