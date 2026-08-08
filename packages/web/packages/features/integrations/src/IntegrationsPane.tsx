"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  Bookmark,
  Calendar,
  Landmark,
  ListTodo,
  Mail,
  MessageSquareText,
  MessagesSquare,
  Music,
  Plug,
  Share2,
  StickyNote,
  UserRound,
} from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { TopicSelectHint } from "@agentic-toolkit/ui/blocks";
import { Button } from "@agentic-toolkit/ui/components/button";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import {
  integrationsApi,
  type MaskedProviderConfig,
  type ProviderCatalogEntry,
} from "@agentic-toolkit/data/integrations";
import { isForbidden } from "@agentic-toolkit/data";
import { useRecordAffordance } from "@agentic-toolkit/resource";
import { useMasterDetailForm } from "@agentic-toolkit/resource";
import { useMasterDetailLevel } from "@agentic-toolkit/resource";
import type { TopicLeaf } from "@agentic-toolkit/resource";
import {
  intBlank,
  intDiffers,
  intToBody,
  intToCreateBody,
  intToInput,
  intValidate,
  type IntegrationInput,
} from "./IntegrationDetail";
import { IntegrationDetailView } from "./IntegrationDetailView";
import { AddIntegrationModal } from "./AddIntegrationModal";

// A leading icon per row keyed off the provider's FIRST service type (the icon-only rail strip
// needs every row to carry a glyph). Falls back to a generic plug for a service type not mapped
// here (or a provider with no service types).
const SERVICE_TYPE_ICONS: Record<string, ReactNode> = {
  email: <Mail />,
  sms: <MessageSquareText />,
  messaging: <MessagesSquare />,
  messages: <MessagesSquare />,
  calendar: <Calendar />,
  tasks: <ListTodo />,
  bookmarks: <Bookmark />,
  notes: <StickyNote />,
  music: <Music />,
  social: <Share2 />,
  profile: <UserRound />,
  financial: <Landmark />,
};

/**
 * The row's ADDRESS — its rdid when it has one, else its uuid. Both are accepted by every by-id
 * integrations route (GET/PUT/DELETE resolve a uuid OR an rdid), so the uuid is a complete
 * substitute, and it is the only correct fallback: `rdid` is nullable (a row predating the mint,
 * or one whose canonical mapping an operator freed), and a null — like the `""` the API used to
 * send in its place — is not an identity. Keying on the raw field would collapse every unmapped
 * config in the list into one row, and hand the master/detail machine one shared id for all of
 * them. Every identity, key, and URL segment in this pane goes through here.
 */
export const addressOf = (r: MaskedProviderConfig): string => r.rdid ?? r.id;

/**
 * Merge the by-id fallback row into the loaded collection. Exported — with `addressOf` — so the
 * `null === null` trap is pinnable directly: comparing raw `rdid`s reads two DIFFERENT unmapped
 * configs as the same row, and the deep-linked one is then silently dropped from the list — a bug
 * no type check can see, because `null === null` is perfectly legal.
 */
export function mergeFetchedRow(
  configs: MaskedProviderConfig[],
  fetched: MaskedProviderConfig | null,
): MaskedProviderConfig[] {
  const list = [...configs];
  if (fetched && !list.some((c) => addressOf(c) === addressOf(fetched))) list.push(fetched);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

/**
 * Integrations settings pane — the ecosystem's provider-config INSTANCES as a master/detail.
 * Each row is one saved integration instance (`listProviderConfigs`), addressed by `addressOf`
 * (deep links are `…/integrations/<rdid-or-uuid>`); multiple instances of the same service are allowed,
 * so the row shows the instance NAME with the provider's category subtitle. Selecting a row
 * renders the shared `IntegrationDetailView` in `mode="saved"` (which owns its own Save and, for
 * OAuth-family providers, its connected-accounts manager). "Add integration" opens the two-pane
 * `AddIntegrationModal` over the stack; the created instance is selected so its detail opens when
 * the modal is closed. Removing an instance deletes its stored config + secret.
 */
export function IntegrationsPane({
  ecosystemId,
  leaf,
}: {
  ecosystemId?: string;
  /** Accepted for the ScopedPane prop shape; the breadcrumb + level title name the pane now. */
  title?: ReactNode;
  /** Accepted for the ScopedPane prop shape; there is no button bar to host a "?" popover now. */
  help?: ReactNode;
  /** Deep-linkable instance selection (`…/integrations/<rdid-or-uuid>`). */
  leaf?: TopicLeaf;
}) {
  const [configs, setConfigs] = useState<MaskedProviderConfig[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderCatalogEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  // Creating is a MODAL over the stack (HTD `must-create-in-modal`): the `+` opens it, and on
  // add the new instance is selected so its REAL detail opens once the modal is dismissed.
  const [modalOpen, setModalOpen] = useState(false);

  const providerById = useMemo(
    () => new Map((providers ?? []).map((p) => [p.providerId, p])),
    [providers],
  );

  const refreshConfigs = useCallback(async () => {
    if (!ecosystemId) {
      setConfigs([]);
      return;
    }
    setLoadError(null);
    try {
      setConfigs(await integrationsApi.listProviderConfigs(ecosystemId));
    } catch (err) {
      if (!isForbidden(err)) {
        reportUnexpectedAuthError(err, { feature: "integrations-pane", step: "load" });
      }
      setConfigs([]);
      setLoadError(
        isForbidden(err)
          ? "You don't have access to this ecosystem's integrations."
          : err instanceof Error
            ? err.message
            : "Failed to load integrations.",
      );
    }
  }, [ecosystemId]);

  useEffect(() => {
    void refreshConfigs();
  }, [refreshConfigs]);

  // The provider catalog is ecosystem-independent, so load it once.
  useEffect(() => {
    let alive = true;
    integrationsApi
      .listProviders()
      .then((p) => {
        if (alive) setProviders(p);
      })
      .catch((err) => {
        reportUnexpectedAuthError(err, { feature: "integrations-pane", step: "load-catalog" });
        if (!alive) return;
        setProviders([]); // don't hang the UI on "Loading…"
        setCatalogError(err instanceof Error ? err.message : "Failed to load providers.");
      });
    return () => {
      alive = false;
    };
  }, []);

  // Selection lives in the URL leaf segment (an address — see `addressOf`). Hoisted to a stable
  // primitive so the derived values below memoize on it cleanly.
  const leafId = leaf?.leafId ?? null;

  // The selected instance, resolved from the loaded list by its address.
  const selectedInList = (configs ?? []).find((c) => addressOf(c) === leafId) ?? null;

  // Fallback for a deep link the list hasn't surfaced yet (or an instance addressable by id but
  // not in the list): fetch the masked config by id/rdid so its detail still resolves. State is
  // set only in the async callbacks; staleness (a fetch for a since-changed address) is filtered
  // out when deriving `fetchedCfg` below, so no synchronous reset is needed here.
  const [fetchedById, setFetchedById] = useState<MaskedProviderConfig | null>(null);
  useEffect(() => {
    if (!leafId || !ecosystemId || selectedInList) return;
    let alive = true;
    integrationsApi
      .getProviderConfigById(ecosystemId, leafId)
      .then((c) => {
        if (alive) setFetchedById(c);
      })
      .catch((err) => {
        reportUnexpectedAuthError(err, { feature: "integrations-pane", step: "load-instance" });
        if (alive) setFetchedById(null);
      });
    return () => {
      alive = false;
    };
  }, [leafId, ecosystemId, selectedInList]);

  // Trust the by-id fallback only when it matches the current selection (it may be stale from a
  // previous address, or absent while a fetch is in flight). Compared on `addressOf`, not the raw
  // rdid: the fetch is issued WITH `leafId`, so for a row this pane addressed by uuid the reply
  // carries a null rdid and only the derived address can recognize it as the row asked for.
  const fetchedCfg = leafId && fetchedById && addressOf(fetchedById) === leafId ? fetchedById : null;
  const cfg = selectedInList ?? fetchedCfg;
  const provider = cfg ? providerById.get(cfg.providerId) : undefined;

  // One row per instance, sorted by name. The deep-linked instance is kept present even before
  // the list fetch surfaces it (resolved by-id above) so the level highlights it and the form
  // selects it.
  //
  // Gated on the provider catalog too (not just `configs`), because a leaf/param navigation
  // (e.g. right after Add) remounts this pane's subtree, refetching BOTH lists fresh — and if
  // the provider-configs fetch resolves first, the toolkit's `useMasterDetailForm` re-hydrate
  // effect would find the row in `items` immediately and seed the draft via `toInput` (=
  // `intToInput`) while `providerById` is still empty, permanently locking in a provider-less
  // draft with its api_key `fields` left blank (that effect only seeds once per selected id).
  // Withholding `rows` until the catalog has loaded keeps the row invisible to that effect
  // until `toInput` can resolve the provider.
  // Memoized: `rows` is the `items` identity `useMasterDetailForm`/`useMasterDetailLevel` compare
  // against, so a fresh array on every render would re-run their item effects each pass.
  const rows = useMemo<MaskedProviderConfig[] | null>(() => {
    if (configs === null || providers === null) return null;
    // On `addressOf` again — `c.rdid === fetchedCfg.rdid` would read `null === null` as a match
    // and swallow the deep-linked row whenever any OTHER unmapped config is in the list.
    return mergeFetchedRow(configs, fetchedCfg);
  }, [configs, providers, fetchedCfg]);

  const urlSelection = leaf
    ? { selectedId: leaf.leafId, onSelect: leaf.onSelect }
    : undefined;

  // The master/detail machine drives selection (URL-keyed via `leaf`), the selected instance's
  // draft (seeded from `intToInput` on address change), the pane-exit unsaved-work guard, and the
  // delete flow. The saved-instance detail (`IntegrationDetailView`) owns its own Save button, so
  // this pane does NOT render a master-detail Save button bar — the guard's `update` is only the
  // background exit-save path; `create` is unused (creating is the modal). Delete is a
  // destructive control in the detail wired to `form.actions.onDelete` + the shared AlertModal.
  const form = useMasterDetailForm<MaskedProviderConfig, IntegrationInput>({
    items: rows,
    getId: addressOf,
    urlSelection,
    blank: () => intBlank(""),
    toInput: (r) => intToInput(r, providerById.get(r.providerId)),
    validate: (draft) => intValidate(draft, providerById.get(draft.providerId), cfg),
    differs: intDiffers,
    create: (input) =>
      integrationsApi.createProviderConfig(
        ecosystemId ?? "",
        intToCreateBody(input, providerById.get(input.providerId)),
      ),
    // `id` is the machine's own id for the row being saved (`getId` = `addressOf`), and PUT
    // accepts a uuid OR an rdid — so address the row by it directly, whichever it is. Reaching
    // for `cfg?.id` instead would write to whatever instance is SELECTED right now, which on the
    // background exit-save path is not necessarily the row the machine is flushing.
    update: (id, input) =>
      integrationsApi.updateProviderConfig(ecosystemId ?? "", id, {
        name: input.name.trim(),
        ...intToBody(input, providerById.get(input.providerId)),
      }),
    remove: (r) => integrationsApi.deleteProviderConfigById(ecosystemId ?? "", r.id),
    confirmDelete: (r) =>
      `Remove the "${r.name}" integration? This permanently deletes its stored configuration and secret.`,
    refresh: refreshConfigs,
    createLabel: "Add integration",
  });

  // The host-injected per-record affordance (the hub supplies its api-explorer button); null on
  // a standalone feature site → the detail's trailing row renders nothing at all.
  const renderRecordAffordance = useRecordAffordance();

  // The row's leading icon: the provider's first service type → a glyph (generic plug otherwise).
  const iconForRow = (r: MaskedProviderConfig): ReactNode => {
    const first = providerById.get(r.providerId)?.serviceTypes?.[0];
    return (first && SERVICE_TYPE_ICONS[first]) || <Plug />;
  };

  useMasterDetailLevel({
    id: "integrations-list",
    title: "Integrations",
    form,
    items: rows,
    getId: addressOf,
    getLabel: (r) => r.name,
    getSublabel: (r) => providerById.get(r.providerId)?.subtitle ?? "",
    getItemIcon: iconForRow,
    newLabel: "Add integration",
    leaf,
    // A failed load resolves to `[]` (see refreshConfigs), so name the error rather than hiding
    // it behind "No integrations yet.". Also checks `providers` (see the `rows` gate above) so
    // this doesn't misreport "No integrations yet." during the brief window where configs have
    // resolved but the catalog hasn't.
    emptyLabel: loadError
      ? "Couldn't load integrations."
      : configs === null || providers === null
        ? "Loading…"
        : "No integrations yet.",
    onNew: () => setModalOpen(true),
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {loadError && <p className="px-6 pt-4 text-sm text-apt-red">{loadError}</p>}
      {catalogError && <p className="px-6 pt-4 text-sm text-apt-red">{catalogError}</p>}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        {cfg && provider && form.draft ? (
          <div className="flex flex-col gap-6">
            {/* The row exists only when a host actually supplies an affordance — an empty
                flex row would otherwise open a gap above the detail on every standalone site. */}
            {renderRecordAffordance && (
              <div className="flex items-center justify-end">
                {renderRecordAffordance({
                  path: "/integrations/ecosystems/{ecosystemId}/provider-configs/{configId}",
                  pathValues: { ecosystemId, configId: cfg.id },
                  title: "Integration config API",
                })}
              </div>
            )}
            <IntegrationDetailView
              key={addressOf(cfg)}
              provider={provider}
              ecosystemId={ecosystemId ?? ""}
              mode="saved"
              config={cfg}
              draft={form.draft}
              onChange={form.onChange}
              // IntegrationDetailView owns Save and hands back the saved row directly, bypassing
              // the master-detail `form` — so its built-in re-hydrate-draft-from-saved-entity
              // never runs. Without this, a freshly-saved secret leaves `form.draft`'s secret
              // field holding the just-typed value while a re-derived baseline reads it blank
              // (secrets are never echoed back), so `intDiffers` stays true forever and the
              // pane-exit guard false-prompts "unsaved changes" on the next navigation. Reset the
              // draft here so it matches what the toolkit's own save() does.
              onSaved={(row) => {
                void refreshConfigs();
                form.onChange(intToInput(row, provider));
              }}
              // A rotation touches nothing the operator typed, so it deliberately does NOT reset
              // the draft — only the cached list row, which is where `cfg` comes from and would
              // otherwise keep showing the retired webhook secret.
              onRotated={() => void refreshConfigs()}
            />
            <div className="flex flex-col gap-2 border-t border-apt-border pt-6">
              <div>
                <Button variant="destructive" onClick={() => form.actions.onDelete()}>
                  Remove integration
                </Button>
              </div>
              <p className="text-xs text-apt-text-muted">
                Deletes this integration and its stored credentials. Connected accounts are
                removed separately, via Disconnect.
              </p>
            </div>
          </div>
        ) : leaf?.leafId && (configs === null || providers === null) ? (
          <EmptyState title="Loading…" />
        ) : loadError ? (
          <EmptyState title="Couldn't load integrations." />
        ) : configs === null ? (
          <EmptyState title="Loading…" />
        ) : (
          // Nothing selected and the list loaded: the almost-empty centered select-nudge, not a
          // dashed EmptyState — matches the workspace/feature rail's TopicSelectHint so an
          // unselected leaf reads the same everywhere.
          <TopicSelectHint title="Select an integration to configure, or add one." />
        )}
      </div>

      <AddIntegrationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        ecosystemId={ecosystemId ?? ""}
        providers={providers}
        // Do NOT close the modal here — it stays open so the user can add another; it closes via
        // its own ✕/Escape. Selecting the new address means the created instance's detail is
        // showing once they DO close it.
        onAdded={(row) => {
          void refreshConfigs();
          leaf?.onSelect(addressOf(row));
        }}
      />

      {/* Delete confirm — the shared AlertModal, driven by the master-detail form's delete flow. */}
      <AlertModal
        open={form.actions.deletePrompt != null}
        tone="error"
        title="Confirm deletion"
        description={form.actions.deletePrompt ?? undefined}
        confirmLabel="Delete"
        confirmVariant="destructive"
        cancelLabel="Cancel"
        busy={form.actions.deleting}
        onConfirm={() => form.actions.onConfirmDelete?.()}
        onCancel={() => form.actions.onCancelDelete?.()}
      />
    </div>
  );
}
