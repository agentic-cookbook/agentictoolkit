"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCircle } from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { readTokenSubject } from "@agentic-toolkit/data";
import { HierarchicalDetailView, Field, type TopicDetailItem, type TopicLevel } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";
import { slugify } from "@agentic-toolkit/ui/lib/slug";
import { validateLeaf } from "@agentic-toolkit/ui/lib/rdid";
import { StackLevels, useRailHost, CreateResourceDialog } from "@agentic-toolkit/resource";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { api, type Persona, type UserService } from "@agentic-toolkit/data/personas";
import { PersonaEditor } from "./PersonaEditor";
import { PersonasTable } from "./PersonasTable";

/**
 * The Personas feature: the persona list as a stack LEVEL and the editor as the leaf (the "All
 * personas" table while nothing is open). Under a rail host it PUBLISHES its level into the host's
 * merged stack (via `useRailHost`) and renders only the leaf; standalone it renders its own
 * HierarchicalTopicDetail. "New Persona" is a `+` in the list header; the breadcrumb names the open
 * persona (from the level).
 *
 * DUAL SELECTION MODE (mirrors useMasterDetailForm.urlSelection): pass `urlSelection` and the open
 * persona + editor sub-tab are URL-driven + deep-linkable — a host's top-level Personas route wires
 * this (see `PersonasFeature`, or the hub's `PersonasGroupRoute`). Omit it — as an embedded launcher
 * does — and selection is internal state, so opening a persona happens IN PLACE without navigating
 * out of the surrounding surface.
 *
 * Three facets the editor renders cross a package boundary this feature can't reach on its own, so
 * a host injects them (see {@link PersonaEditor} for the exact fallback behavior when omitted):
 * `renderChatPane`, `profileUrlFor` (also used by {@link PersonasTable}'s Preview link), and
 * `renderKnowledgeBases`.
 */
export function PersonasSection({
  urlSelection,
  workspaceSlug,
  renderChatPane,
  profileUrlFor,
  renderKnowledgeBases,
  renderProject,
}: {
  /** The workspace whose personas this section shows. Resolved server-side to the workspace's
   *  OWNING principal (`?workspace=`): the list holds only personas that principal owns, and a
   *  persona created here is owned BY that principal (an org workspace's persona is org-owned).
   *  Omit for the caller's own creator-scoped personas (the pre-workspace behavior). */
  workspaceSlug?: string;
  urlSelection?: {
    /** The open persona's id, from the first URL path segment (`/<slug>/personas/<id>`). */
    personaId?: string;
    /** The active editor sub-tab, from the second segment (`/<slug>/personas/<id>/<subtab>`). */
    subtab?: string;
    /** Route to a persona (null clears back to the list). */
    onSelectPersona: (id: string | null) => void;
    /** Route to an editor sub-tab (null clears to the bare persona URL). Optional: a caller that
     *  URL-drives ONLY the open persona (e.g. a grouped ecosystem member ceding just the entity
     *  segment) omits it, and the editor keeps its own internal sub-tab selection. */
    onSelectSubtab?: (subtab: string | null) => void;
  };
  /** Renders the live try-it chat for a saved persona. See {@link PersonaEditor}. */
  renderChatPane?: (persona: Persona) => ReactNode;
  /** The persona's public profile URL for a given slug — threaded to both the editor's Identity
   *  facet and {@link PersonasTable}'s Preview link. See {@link PersonaEditor}. */
  profileUrlFor?: (slug: string) => string;
  /** Renders the Knowledge Bases browser scoped to a persona's owned ecosystem. See
   *  {@link PersonaEditor}. */
  renderKnowledgeBases?: (scopeEcosystemId: string) => ReactNode;
  /** Renders a persona's auto-provisioned project (the Project facet). See
   *  {@link PersonaEditor}. */
  renderProject?: (personaId: string) => ReactNode;
}) {
  // Data rides the toolkit's shared react-query cache, NOT local state: Next remounts the page
  // subtree on every param navigation, so local state would restart from null on each persona/topic
  // click and the whole list "blinks" through Loading…. The cache survives the remount, so a
  // reselect renders instantly; invalidation (reload, below) still refreshes after writes.
  //
  // Keys carry the signed-in principal (the access token's `sub`, read at render): the cache
  // outlives an identity change (nothing clears the shared QueryClient on auth swap — e.g.
  // tokens replaced by another tab), so an unscoped key could serve the PREVIOUS account's
  // personas as "fresh" on the next remount. Same tenant scoping useResourceList applies to
  // its module cache.
  const tenant = readTokenSubject();
  const queryClient = useQueryClient();
  const personasQuery = useQuery({
    queryKey: ["personas", tenant, workspaceSlug ?? null],
    queryFn: () => api.personas.list({ workspace: workspaceSlug }),
  });
  const servicesQuery = useQuery({
    queryKey: ["persona-services", tenant],
    queryFn: () => api.services.list(),
  });
  const services = servicesQuery.data ?? [];
  // Surface load failures once settled (after retry), matching the old catch-and-report.
  const loadError = personasQuery.error ?? servicesQuery.error ?? null;
  useEffect(() => {
    if (loadError) reportUnexpectedAuthError(loadError, { feature: "personas", step: "list" });
  }, [loadError]);
  const error = loadError
    ? loadError instanceof Error
      ? loadError.message
      : "Failed to load personas."
    : null;
  // Creating a persona is a MODAL over the stack, never a blank editor leaf (HTD recipe
  // `must-create-in-modal`): the `+` opens it, and on save the created persona is selected so its
  // full editor (personality, purpose, abilities, …) opens.
  const [newOpen, setNewOpen] = useState(false);
  // Dual-mode selection: URL-driven (deep-linkable) when `urlSelection` is passed, else internal
  // state (the embedded /home launcher / ecosystem rail).
  const { selectedId: openPersonaId, select } = useDualModeSelection(
    urlSelection && {
      selectedId: urlSelection.personaId ?? null,
      onSelect: urlSelection.onSelectPersona,
    },
  );

  // Open a persona (or null to close): URL-driven callers navigate, embedded callers set local state.
  const selectPersona = (id: string | null) => {
    select(id);
  };

  // After a write: invalidate EVERY personas variant (all workspace scopes — a create/save can
  // affect other workspaces' lists too) plus the services list; active queries refetch immediately.
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["personas"] });
    void queryClient.invalidateQueries({ queryKey: ["persona-services"] });
  };

  const rows = personasQuery.data ?? [];
  const items: TopicDetailItem[] = rows.map((p) => ({
    id: p.id,
    label: p.name,
    sublabel: p.slug,
    icon: <UserCircle size={16} aria-hidden />,
  }));

  // The open persona: the selected id resolved against the loaded rows. An unknown/deleted id (or
  // none) is "nothing open" → the All table (fail-fast, never a blank screen).
  const openPersona = openPersonaId ? rows.find((p) => p.id === openPersonaId) ?? null : null;
  const levels: TopicLevel[] = [
    {
      id: "personas",
      title: "Personas",
      items,
      selectedId: openPersona?.id ?? null,
      onSelect: (id) => selectPersona(id),
      onClear: () => selectPersona(null),
      emptyLabel: "No personas yet.",
      // "New Persona" is a right-justified `+` in the list header; it opens the create modal.
      onNew: () => setNewOpen(true),
      newLabel: "New Persona",
      // This level's unselected state is a REAL landing (the All table below), never the automatic
      // TopicOverview grid.
      overview: false,
    },
  ];

  // DUAL MODE: under a rail host, PUBLISH the persona level into the host's merged stack (its
  // selected row becomes the breadcrumb tail — Acme ▸ Personas ▸ Bob); standalone, render an own HTD.
  const railHost = useRailHost();

  const content =
    personasQuery.isPending ? (
      <p className="p-6 text-sm text-apt-text-muted">Loading…</p>
    ) : openPersona ? (
      <PersonaEditor
        key={openPersona.id}
        persona={openPersona}
        services={services}
        workspaceSlug={workspaceSlug}
        // Sub-tabs are URL-driven + deep-linkable only when this section is URL-driven; embedded,
        // the editor keeps its own internal tab selection (opening unselected), unchanged.
        activeSubtab={urlSelection?.subtab}
        onSubtabChange={urlSelection?.onSelectSubtab}
        onSaved={() => reload()}
        onCancel={() => selectPersona(null)}
        renderChatPane={renderChatPane}
        profileUrlFor={profileUrlFor}
        renderKnowledgeBases={renderKnowledgeBases}
        renderProject={renderProject}
      />
    ) : (
      <>
        <ErrorText error={error} className="px-6 pt-4" />
        <PersonasTable personas={rows} onSelect={(id) => selectPersona(id)} profileUrlFor={profileUrlFor} />
      </>
    );

  // Create is a scoped modal: name + slug only (HTD recipe `must-create-in-modal`). Everything else
  // — description, personality, purpose, avatar, abilities, permissions — lives in the full editor
  // that opens once the created persona is selected. The backend accepts an empty purpose on create,
  // so the persona exists immediately and the editor's Purpose facet guides completing it.
  const newDialog = newOpen ? (
    <CreateResourceDialog<{ name: string; slug: string }, Persona>
      ariaLabel="New persona"
      heading="New persona"
      blank={() => ({ name: "", slug: "" })}
      validate={(d) =>
        !d.name.trim()
          ? "A name is required."
          : !d.slug.trim()
            ? "A slug is required."
            : validateLeaf(d.slug) ?? null
      }
      create={(d) =>
        api.personas.create(
          { name: d.name.trim(), slug: d.slug.trim(), modelPrompt: "", visibility: "private" },
          { workspace: workspaceSlug },
        )
      }
      onClose={() => setNewOpen(false)}
      onCreated={(saved) => {
        setNewOpen(false);
        selectPersona(saved.id);
        reload();
      }}
      renderForm={(draft, onChange, error) => (
        <>
          <Field label="Name">
            <Input
              /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
              autoFocus
              value={draft.name}
              placeholder="Bob"
              onChange={(e) => {
                const name = e.target.value;
                // Keep the slug synced to the name until the user hand-edits it (breaking the
                // equality), after which name edits leave their chosen slug alone.
                const keepInSync = draft.slug === "" || draft.slug === slugify(draft.name);
                onChange({ name, slug: keepInSync ? slugify(name) : draft.slug });
              }}
            />
          </Field>
          <Field
            label="Slug"
            hint="URL-safe id (lowercase, digits, hyphens). The persona's public URL."
            error={draft.slug ? validateLeaf(draft.slug) ?? undefined : undefined}
          >
            <Input
              value={draft.slug}
              placeholder="bob"
              onChange={(e) => onChange({ ...draft, slug: e.target.value })}
            />
          </Field>
          {error && <p className="text-sm text-apt-red">{error}</p>}
        </>
      )}
    />
  ) : null;

  // Under a rail host: PUBLISH the persona level (StackLevels advances the depth so the editor's
  // topics land after it) and render the leaf. Standalone: own HTD.
  if (railHost)
    return (
      <>
        <StackLevels levels={levels}>{content}</StackLevels>
        {newDialog}
      </>
    );
  return (
    <>
      <HierarchicalDetailView levels={levels} showBreadcrumb={false}>
        {content}
      </HierarchicalDetailView>
      {newDialog}
    </>
  );
}
