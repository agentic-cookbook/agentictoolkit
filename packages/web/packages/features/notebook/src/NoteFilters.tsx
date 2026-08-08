"use client";

import { SearchFilterBar } from "@agentic-toolkit/ui/components/search-filter-bar";

/** Controlled list filters. Empty string means "no filter" for that axis. */
export interface FilterState {
  q: string;
  tag: string;
}

/**
 * Search + tag filters that sit above the note list. A thin domain adapter that maps the
 * {@link FilterState} axes onto the shared `SearchFilterBar` — the filter-bar markup itself
 * lives once in `@agentic-toolkit/ui`.
 *
 * There is deliberately NO category axis here, unlike the research surface this is
 * otherwise a copy of: in the notebook the category IS the rail selection, so a dropdown
 * would be a second control for an axis the user has already navigated. The two would
 * disagree the moment either moved.
 */
export function NoteFilters({
  filters,
  onChange,
  tags,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  tags: string[];
}) {
  return (
    <SearchFilterBar
      search={{
        value: filters.q,
        onChange: (q) => onChange({ ...filters, q }),
        label: "Search notes",
        placeholder: "Search notes…",
      }}
      filters={[
        {
          name: "tag",
          label: "Filter by tag",
          value: filters.tag,
          options: tags,
          allLabel: "All tags",
          onChange: (tag) => onChange({ ...filters, tag }),
        },
      ]}
    />
  );
}
