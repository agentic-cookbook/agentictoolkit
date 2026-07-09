"use client";

import type { ReactNode } from "react";
import { RailHostBoundary, useBasePathRoute } from "@agentic-toolkit/resource";
import type { Persona } from "@agentic-toolkit/data/personas";
import { PersonasSection } from "./PersonasSection";

/**
 * The Personas feature's site entry — a thin, host-agnostic wrapper that drives
 * {@link PersonasSection}'s `urlSelection` from an explicit `basePath` (via
 * {@link useBasePathRoute}), modeled on `DashboardsFeature`. A feature site mounts this directly
 * (`<PersonasFeature basePath="/home" {...parsePersonasPath(path)} />`) with no host-side glue
 * beyond parsing its own catch-all segments with {@link parsePersonasPath}. The hub's own
 * `PersonasGroupRoute` derives its wiring itself instead of using this entry, since it also needs
 * to place Personas as a GROUP member alongside Persona Services + Knowledge Bases.
 */
export function PersonasFeature({
  basePath,
  personaId,
  subTab,
  renderChatPane,
  profileUrlFor,
  renderKnowledgeBases,
}: {
  /** This feature's URL base — every push lands under it (e.g. `/<slug>/personas`, or `/home` on a
   *  feature site). Supplied by the host route rather than derived here, so the same feature
   *  mounts under either scheme. */
  basePath: string;
  /** The open persona's id (first path segment after `basePath`), or undefined for the All table. */
  personaId?: string;
  /** The active editor sub-tab (second path segment), or undefined for the first tab. */
  subTab?: string;
  /** Renders the live try-it chat for a saved persona. See {@link PersonasSection}. */
  renderChatPane?: (persona: Persona) => ReactNode;
  /** The persona's public profile URL for a given slug. See {@link PersonasSection}. */
  profileUrlFor?: (slug: string) => string;
  /** Renders the Knowledge Bases browser scoped to a persona's owned ecosystem. See
   *  {@link PersonasSection}. */
  renderKnowledgeBases?: (scopeEcosystemId: string) => ReactNode;
}) {
  const { pushSegment, pushNested } = useBasePathRoute(basePath);
  // RailHostBoundary: standalone, PersonasSection's own-HTD fallback renders the persona
  // list, but PersonaEditor's facet tabs + exit guards exist only as rail-host publications
  // — the boundary self-hosts them so the editor is whole on a bare feature site.
  return (
    <RailHostBoundary>
      <PersonasSection
        urlSelection={{
          personaId,
          subtab: subTab,
          onSelectPersona: pushSegment,
          onSelectSubtab: (subtab) => pushNested(personaId, subtab),
        }}
        renderChatPane={renderChatPane}
        profileUrlFor={profileUrlFor}
        renderKnowledgeBases={renderKnowledgeBases}
      />
    </RailHostBoundary>
  );
}
