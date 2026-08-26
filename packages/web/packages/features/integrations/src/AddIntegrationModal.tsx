"use client";

import { useRef, useState, type ReactElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@agenticdevelopertoolkit/ui/components/dialog";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { List, ListItem } from "@agenticdevelopertoolkit/ui/components/list";
import { Alert } from "@agenticdevelopertoolkit/ui/components/alert";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import type { MaskedProviderConfig, ProviderCatalogEntry } from "@agentic-toolkit/data/integrations";
import { intBlank, type IntegrationInput } from "./IntegrationDetail";
import { IntegrationDetailView } from "./IntegrationDetailView";
import { clearDraft, listDrafts, loadDraft, saveDraft } from "./integration-draft-store";

/**
 * The two-pane Add-integration modal (D2). Left: a filterable, alphabetized service list
 * of the WHOLE provider catalog (already-configured providers are NOT hidden — an owner
 * may add a second instance). Right: the shared `IntegrationDetailView` in `mode='add'`,
 * driven by a per-provider draft that is persisted (secrets stripped) to localStorage so a
 * half-filled integration survives a close/reopen. A resume banner offers to pick up (or
 * discard) any unfinished draft for this ecosystem. The modal stays open after a successful
 * add so another instance can be configured; the parent (`onAdded`) decides whether to
 * refresh or select.
 */

/** The `p.configFields` keys that hold a secret — the caller-supplied secret-key list the
 *  draft store blanks before persisting. */
function secretKeysOf(provider: ProviderCatalogEntry): string[] {
  return (provider.configFields ?? []).filter((f) => f.secret).map((f) => f.key);
}

/** Empty filter → every provider; otherwise a case-insensitive name OR subtitle match. */
function matches(query: string, provider: ProviderCatalogEntry): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    provider.displayName.toLowerCase().includes(needle) ||
    provider.subtitle.toLowerCase().includes(needle)
  );
}

export function AddIntegrationModal({
  open,
  onOpenChange,
  ecosystemId,
  providers,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ecosystemId: string;
  /** The provider catalog from `integrationsApi.listProviders` (null while loading). */
  providers: ProviderCatalogEntry[] | null;
  onAdded: (row: MaskedProviderConfig) => void;
}): ReactElement {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<IntegrationInput>(() => intBlank(""));
  // Provider ids with a persisted draft for THIS ecosystem — drives the resume banner.
  const [draftedIds, setDraftedIds] = useState<string[]>([]);
  const filterRef = useRef<HTMLInputElement>(null);

  // Reset to the pristine picker (and re-read this ecosystem's resumable drafts) on the
  // first render and whenever the modal transitions closed→open or the ecosystem changes
  // while open. base-ui keeps the Dialog mounted across open/close, so without this the
  // previous session's selection/filter would linger. This is React's "adjust state during
  // render when a prop changes" pattern (react.dev/reference/react/useState#storing-
  // information-from-previous-renders), which re-renders immediately without the cascading-
  // render cost of a setState-in-effect. The `null` sentinel makes the mount case (which
  // can already be open) run the same reset path as a later transition.
  const [session, setSession] = useState<{ open: boolean; ecosystemId: string } | null>(null);
  if (session === null || session.open !== open || session.ecosystemId !== ecosystemId) {
    setSession({ open, ecosystemId });
    setSelectedProviderId(null);
    setFilter("");
    setDraft(intBlank(""));
    setDraftedIds(open ? listDrafts(ecosystemId).map((d) => d.providerId) : []);
  }

  const selected = selectedProviderId
    ? (providers ?? []).find((p) => p.providerId === selectedProviderId) ?? null
    : null;

  const visible = (providers ?? [])
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .filter((p) => matches(filter, p));

  const selectProvider = (pid: string) => {
    setSelectedProviderId(pid);
    setDraft(loadDraft(ecosystemId, pid) ?? { ...intBlank(pid), name: "" });
  };

  const handleChange = (next: IntegrationInput) => {
    setDraft(next);
    if (selectedProviderId && selected) {
      saveDraft(ecosystemId, selectedProviderId, next, secretKeysOf(selected));
    }
  };

  const handleSaved = (row: MaskedProviderConfig) => {
    if (selectedProviderId) {
      clearDraft(ecosystemId, selectedProviderId);
      setDraftedIds((ids) => ids.filter((id) => id !== selectedProviderId));
    }
    // Stay open — IntegrationDetailView already cleared its fields so another can be added.
    onAdded(row);
  };

  const discardDrafts = () => {
    for (const pid of draftedIds) clearDraft(ecosystemId, pid);
    setDraftedIds([]);
  };

  // The banner offers to resume an unfinished draft — only before a provider is chosen.
  const firstDraftedId = draftedIds[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={filterRef}
        className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>Add integration</DialogTitle>
          <DialogDescription>Pick a service to configure for this ecosystem.</DialogDescription>
        </DialogHeader>

        {selectedProviderId === null && firstDraftedId !== undefined && (
          <Alert variant="accent" className="flex flex-col gap-2">
            <span className="text-sm text-apt-text">You have an unfinished integration.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={() => selectProvider(firstDraftedId)}>
                Resume
              </Button>
              <Button size="sm" variant="ghost" onClick={discardDrafts}>
                Discard
              </Button>
            </div>
          </Alert>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[minmax(220px,280px)_1fr]">
          {/* Left pane — filterable service list */}
          <div className="flex min-h-0 flex-col gap-2">
            <label htmlFor="add-int-filter" className="sr-only">
              Filter services
            </label>
            <Input
              id="add-int-filter"
              ref={filterRef}
              value={filter}
              placeholder="Filter services"
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {providers === null ? (
                <p className="py-2 text-sm text-apt-text-muted">Loading…</p>
              ) : visible.length === 0 ? (
                <p className="py-2 text-sm text-apt-text-muted">No services match.</p>
              ) : (
                <List>
                  {visible.map((p) => {
                    const active = p.providerId === selectedProviderId;
                    return (
                      <ListItem key={p.providerId} className="p-0">
                        <button
                          type="button"
                          aria-current={active ? "true" : undefined}
                          data-active={active ? "" : undefined}
                          onClick={() => selectProvider(p.providerId)}
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors outline-none hover:bg-apt-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-apt-gold/40 data-[active]:bg-apt-gold/10"
                        >
                          <span className="text-sm font-medium text-apt-text">{p.displayName}</span>
                          {p.subtitle && (
                            <span className="text-xs text-apt-text-muted">{p.subtitle}</span>
                          )}
                        </button>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </div>
          </div>

          {/* Right pane — the shared detail view for the selected provider */}
          <div className="min-h-0 overflow-y-auto">
            {selected ? (
              <IntegrationDetailView
                provider={selected}
                ecosystemId={ecosystemId}
                mode="add"
                config={null}
                draft={draft}
                onChange={handleChange}
                onSaved={handleSaved}
              />
            ) : (
              <p className="py-2 text-sm text-apt-text-muted">Select a service to configure.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
