"use client";

import { FolderCog, Plus, Search, Tags } from "lucide-react";

import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Separator } from "@agentic-toolkit/ui/components/separator";
import { HomeBar } from "@agentic-toolkit/resource";
import { NOTES_CORPUS, type CorpusNoun } from "./corpus";

/**
 * The three axes the notes list narrows on. All three are FILTERS over whatever the rail is
 * already showing — `category` in particular is NOT the rail's category selection: the rail
 * scopes (which part of the notebook you are standing in) and this narrows within it. Naming
 * two different categories therefore yields nothing, which is the honest answer to what was
 * asked; see `resolveListCategory` in note-model.ts.
 */
export interface FilterState {
  /** Free-text search over the note bodies. */
  q: string;
  /** Exact category name, or `""` for no narrowing. */
  category: string;
  /** Exact tag label, or `""` for no narrowing. */
  tag: string;
}

/**
 * The notebook's button bar: the strip under the workspace bar that holds everything acting on
 * the LIST, rather than on one note.
 *
 * ```
 * [search] | [category filter] [edit categories] | [tag filter] [edit tags]  ⟨HomeBar ml-auto⟩  [Create Note]
 * ```
 *
 * The far-right placement comes from `HomeBar`, which every bar on the fleet renders through so
 * the rule lives in one place. This component stays bespoke for the LEFT cluster rather than the
 * shared `SearchFilterBar`, because of that shape: the shared bar puts the search field and the
 * filters in two plain rows with the search taking the slack, and has nowhere to interleave
 * dividers between the filters. Everything inside it is still the shared primitive (`Input`,
 * `Select`, `Separator`, `Button`).
 *
 * The option sets are the caller's, taken from the UNFILTERED note universe, so narrowing the
 * list can never empty the menus that got it there.
 */
export function NoteButtonBar({
  filters,
  onChange,
  categories,
  tags,
  onEditCategories,
  onEditTags,
  onCreateNote,
  noun = NOTES_CORPUS.noun,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  /** Category names to offer. */
  categories: readonly string[];
  /** Tag labels to offer. */
  tags: readonly string[];
  onEditCategories: () => void;
  onEditTags: () => void;
  onCreateNote: () => void;
  /** The corpus's nouns — what "Search notes…" and "Create Note" say when this bar is over a
   *  shelf other than the notebook. Defaults to the notes wording. */
  noun?: CorpusNoun;
}) {
  return (
    <HomeBar
      left={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div role="search" className="relative w-64 min-w-40 shrink">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-apt-text-muted"
            />
            <Input
              type="search"
              value={filters.q}
              aria-label={`Search ${noun.many}`}
              placeholder={`Search ${noun.many}…`}
              className="pl-8"
              onChange={(e) => onChange({ ...filters, q: e.target.value })}
            />
          </div>

          <Separator orientation="vertical" className="h-6" />

          <Select
            aria-label="Filter by category"
            value={filters.category}
            className="w-44"
            onChange={(e) => onChange({ ...filters, category: e.target.value })}
          >
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit categories"
            onClick={onEditCategories}
          >
            <FolderCog className="adh-button__icon" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Select
            aria-label="Filter by tag"
            value={filters.tag}
            className="w-44"
            onChange={(e) => onChange({ ...filters, tag: e.target.value })}
          >
            <option value="">All tags</option>
            {tags.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </Select>
          <Button variant="ghost" size="icon-sm" aria-label="Edit tags" onClick={onEditTags}>
            <Tags className="adh-button__icon" />
          </Button>
        </div>
      }
      right={
        // `apt-highlight` is the site's "the marked thing" token — the one colour a site
        // re-points to say THIS is the action. The default variant's brand gold would make
        // Create Note look like every other primary button on the platform.
        <Button className="bg-apt-highlight hover:bg-apt-highlight/90" onClick={onCreateNote}>
          {/* `data-icon="inline-start"` and no `size`: `Button` sizes its own icons and
              tightens the padding on the icon's side. See `resource-explorer.tsx`. */}
          <Plus data-icon="inline-start" aria-hidden />
          Create {noun.One}
        </Button>
      }
    />
  );
}
