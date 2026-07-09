"use client";

import type { ReactElement } from "react";
import { ScrollText } from "lucide-react";
import { StackGroupDetail } from "@agentic-toolkit/resource";
import { NarrativesFrame } from "./NarrativesFrame";

/**
 * The Narratives workspace feature: a topic→detail view over project-scoped things, published
 * into the one merged stack. Narratives is the first (and, here, only) topic.
 *
 * PRESERVED FROM MAIN: this was main's `projects/ProjectsFeature.tsx` placeholder that occupied the
 * `/<slug>/projects` route (renamed projects→narratives when the full native Projects feature took
 * over `/projects`). It is NOT yet wired to a route — the hub already registers a separate
 * `narratives` workspace feature (a custom `/narratives` iframe embed of the published bundle), so
 * reconciling this component-based surface with that embed is a deliberate follow-up. Kept, not
 * deleted, so nothing is lost.
 *
 * DUAL SELECTION MODE: pass `urlSelection` and the open section is URL-driven + deep-linkable via a
 * route wrapper (like personas/ecosystems). Omit it (embedded) and the section selection is
 * internal state.
 */
export function NarrativesFeature({
  urlSelection,
}: {
  urlSelection?: {
    /** The open section, from the URL path segment. */
    section?: string;
    /** Route to a section (null clears back to nothing selected). */
    onSelectSection: (id: string | null) => void;
  };
} = {}): ReactElement {
  return (
    <StackGroupDetail
      levelId="project-sections"
      title="Narratives"
      urlSelection={
        urlSelection
          ? { selectedId: urlSelection.section ?? null, onSelect: urlSelection.onSelectSection }
          : undefined
      }
      items={[
        {
          id: "narratives",
          label: "Narratives",
          icon: <ScrollText size={16} aria-hidden />,
          render: () => <NarrativesFrame />,
        },
      ]}
    />
  );
}
