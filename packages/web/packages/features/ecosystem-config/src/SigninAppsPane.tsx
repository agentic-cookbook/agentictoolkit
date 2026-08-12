"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { LogIn } from "lucide-react";

import { useResourceList } from "@agentic-toolkit/data";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
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
  // Creating a sign-in app is a MODAL over the stack, never a blank leaf (HTD recipe
  // `must-create-in-modal`): the `+` opens it, and on save the new app is selected so
  // its REAL detail (GitHub toggle, return origins, connect snippet) opens.
  const [newOpen, setNewOpen] = useState(false);

  // The hub addresses the ecosystem by its rdid (ecosystem.<slug>); derive the slug to preview
  // the composed client id while creating. Empty when the id isn't an rdid.
  const ecoSlug = ecosystemId?.startsWith("ecosystem.")
    ? ecosystemId.slice("ecosystem.".length)
    : "";

  // Cached by ecosystem, so coming back to Sign-in apps paints the rows it already had and
  // revalidates behind them. `useCallback` is load-bearing: the hook treats a NEW fetcher identity
  // as "re-read", so an inline closure here would re-fetch on every render.
  //
  // With no ecosystem there is nothing to ask for, and a promise that never settles is how this
  // hook is held in Loading — the alternative, resolving `[]`, would state "no sign-in apps yet"
  // about an ecosystem nobody has named yet. A failed read leaves `apps` null, and what keeps that
  // off "Loading…" forever is the labels below reading `loadError` FIRST.
  const load = useCallback(
    () => (ecosystemId ? signinAppsApi.list(ecosystemId) : new Promise<SigninApp[]>(() => {})),
    [ecosystemId],
  );
  const {
    items: apps,
    reload: refresh,
    error: loadError,
    isFetching,
  } = useResourceList<SigninApp>(`ecosystem:${ecosystemId ?? ""}:signin-apps`, load);

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
    // The spinner before "Sign-in apps" — the only thing that says a revalidation is running behind
    // rows the cache already put on screen. `emptyLabel` covers the FIRST read and nothing after.
    busy: isFetching,
    onNew: () => setNewOpen(true),
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ErrorText error={loadError} className="px-6 pt-4" />
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
              <ErrorText error={error} />
            </>
          )}
        />
      )}
    </div>
  );
}
