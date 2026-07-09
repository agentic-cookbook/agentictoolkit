"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { UserCircle } from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { HierarchicalTopicDetail, type TopicDetailItem, type TopicLevel } from "@agentic-toolkit/ui/blocks";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";
import { StackLevels, useRailHost } from "@agentic-toolkit/resource";
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
  renderChatPane,
  profileUrlFor,
  renderKnowledgeBases,
}: {
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
}) {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [services, setServices] = useState<UserService[]>([]);
  const [error, setError] = useState<string | null>(null);
  // `creating` (a new draft, no id yet) stays LOCAL in both modes — a draft has no URL/id to address,
  // so we never route on create (matches useMasterDetailForm.create). The OPEN persona's id lives in
  // the URL (URL-driven) or internal state (embedded), via useDualModeSelection below.
  const [creating, setCreating] = useState(false);
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
    setCreating(false);
    select(id);
  };

  const reload = useCallback(async () => {
    try {
      const [ps, ss] = await Promise.all([api.personas.list(), api.services.list()]);
      setPersonas(ps);
      setServices(ss);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "personas", step: "list" });
      setError(err instanceof Error ? err.message : "Failed to load personas.");
      setPersonas([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = personas ?? [];
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
      // While creating a new draft the master list highlights nothing (any previously-open id is
      // still tracked; we don't change selection on create).
      selectedId: creating ? null : openPersona?.id ?? null,
      onSelect: (id) => selectPersona(id),
      onClear: () => selectPersona(null),
      emptyLabel: "No personas yet.",
      // "New Persona" is a right-justified `+` in the list header; gold while creating. Embedded, we
      // also clear the open persona so cancelling the draft returns to the All table (the pre-change
      // behavior); URL-driven, the URL is left put (creating masks it) so Cancel returns to it.
      onNew: () => {
        if (!urlSelection) select(null);
        setCreating(true);
      },
      newLabel: "New Persona",
      newActive: creating,
    },
  ];

  // DUAL MODE: under a rail host, PUBLISH the persona level into the host's merged stack (its
  // selected row becomes the breadcrumb tail — Acme ▸ Personas ▸ Bob); standalone, render an own HTD.
  const railHost = useRailHost();

  const content =
    personas === null ? (
      <p className="p-6 text-sm text-apt-text-muted">Loading…</p>
    ) : creating ? (
      // A new draft has no id/URL yet; sub-tabs select in local state (no subtab props). On save,
      // open the created persona (matches useMasterDetailForm.save routing to the new id).
      <PersonaEditor
        key="__new__"
        persona={null}
        services={services}
        onSaved={(saved) => {
          selectPersona(saved.id);
          void reload();
        }}
        onCancel={() => setCreating(false)}
        renderChatPane={renderChatPane}
        profileUrlFor={profileUrlFor}
        renderKnowledgeBases={renderKnowledgeBases}
      />
    ) : openPersona ? (
      <PersonaEditor
        key={openPersona.id}
        persona={openPersona}
        services={services}
        // Sub-tabs are URL-driven + deep-linkable only when this section is URL-driven; embedded, the
        // editor keeps its own internal tab selection (autoSelectFirst), unchanged.
        activeSubtab={urlSelection?.subtab}
        onSubtabChange={urlSelection?.onSelectSubtab}
        onSaved={() => void reload()}
        onCancel={() => selectPersona(null)}
        renderChatPane={renderChatPane}
        profileUrlFor={profileUrlFor}
        renderKnowledgeBases={renderKnowledgeBases}
      />
    ) : (
      <>
        <ErrorText error={error} className="px-6 pt-4" />
        <PersonasTable personas={rows} onSelect={(id) => selectPersona(id)} profileUrlFor={profileUrlFor} />
      </>
    );

  // Under a rail host: PUBLISH the persona level (StackLevels advances the depth so the editor's
  // topics land after it) and render the leaf. Standalone: own HTD.
  if (railHost) return <StackLevels levels={levels}>{content}</StackLevels>;
  return (
    <HierarchicalTopicDetail levels={levels} showBreadcrumb={false}>
      {content}
    </HierarchicalTopicDetail>
  );
}
