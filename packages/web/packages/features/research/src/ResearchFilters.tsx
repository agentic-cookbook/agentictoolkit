"use client";

import { SearchFilterBar } from "@agentic-toolkit/ui/components/search-filter-bar";

/** Controlled list filters. Empty string means "no filter" for that axis. */
export interface FilterState {
  q: string;
  category: string;
  tag: string;
}

/**
 * Search + category/tag filters for the research document list, published by
 * {@link ResearchPane} into the HOME BAR — the page-level strip between the workspace
 * bar and the breadcrumb bar. A thin domain adapter that maps the {@link FilterState}
 * axes onto the shared `SearchFilterBar` — the filter-bar markup itself lives once in
 * `@agentic-toolkit/ui`. Every axis is wired to the backend list endpoint (`q`,
 * `category`, `tag`); the option sets come from the caller's full document universe so
 * a narrowed list never empties its own dropdown.
 */
export function ResearchFilters({
  filters,
  onChange,
  categories,
  tags,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  categories: string[];
  tags: string[];
}) {
  return (
    <SearchFilterBar
      // Fixed here rather than exposed as a prop: this component has exactly ONE call site — the
      // home bar it is published into — and `"inline"` is the shape that bar requires (the default
      // `"stacked"` puts the filters on a second row, which in a strip spanning the page pushes the
      // list it filters down by a whole row). A prop nobody could pass differently would only
      // invite a second, wrong answer.
      orientation="inline"
      search={{
        value: filters.q,
        onChange: (q) => onChange({ ...filters, q }),
        label: "Search research documents",
        placeholder: "Search documents…",
      }}
      filters={[
        {
          name: "category",
          label: "Filter by category",
          value: filters.category,
          options: categories,
          allLabel: "All categories",
          onChange: (category) => onChange({ ...filters, category }),
        },
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
