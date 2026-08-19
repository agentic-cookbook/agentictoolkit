"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@agentic-toolkit/ui/components/card";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { cn } from "@agentic-toolkit/ui/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@agentic-toolkit/ui/components/toggle-group";
import { FeatureTitle } from "./master-detail/MasterDetailLayout";
import { readViewMode, writeViewMode, type ViewMode } from "@agentic-toolkit/data";
import { HomeBar, HomeBarPortal } from "./home-bar";

/**
 * The "All" landing for a resource tab: a filterable index of every resource,
 * shown as a card grid or a compact list. The card header (label + sublabel) is
 * shared; `renderMeta` fills the card body. The chosen view mode persists per
 * collection (FTD spec §7–§8).
 */
export function ResourceLanding<T>({
  items,
  title,
  help,
  emptyLabel,
  basePath,
  getId,
  getLabel,
  getSublabel,
  cardHref,
  renderMeta,
  onNew,
  newLabel,
}: {
  items: T[] | null;
  title: string;
  help: string;
  emptyLabel: string;
  /** Used for the per-collection view-mode storage key. */
  basePath: string;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSublabel: (item: T) => string;
  cardHref: (item: T) => string;
  renderMeta: (item: T) => ReactNode;
  /** Optional "New …" affordance in the header. Used where the landing is the only place a
   *  resource is created (e.g. the Child Ecosystems list, which has no separate rail). */
  onNew?: () => void;
  newLabel?: string;
}): ReactElement {
  const [query, setQuery] = useState("");
  // The All toolbar only renders client-side (items arrive via fetch), so reading
  // the persisted mode in the initializer is hydration-safe and needs no effect.
  const [view, setView] = useState<ViewMode>(() => readViewMode(basePath));

  function chooseView(next: ViewMode): void {
    setView(next);
    writeViewMode(basePath, next);
  }

  const q = query.trim().toLowerCase();
  const rows = items ?? [];
  const filtered = q
    ? rows.filter(
        (it) =>
          getLabel(it).toLowerCase().includes(q) ||
          getSublabel(it).toLowerCase().includes(q),
      )
    : rows;
  const hasItems = items !== null && rows.length > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <FeatureTitle title={title} help={help} />
      <div className="flex flex-col gap-4 px-6 pt-2 pb-6">
        {(onNew || hasItems) && (
          <HomeBarPortal>
            {/* The sides SWAP here relative to the row this replaces. That row put Add on the left
                and search on the right; the fleet rule is the other way round, and this landing was
                the fleet's only exception to it. */}
            <HomeBar
              left={
                hasItems ? (
                  <>
                    <div className="relative">
                      <Search
                        size={14}
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-apt-text-dim"
                      />
                      <Input
                        type="search"
                        aria-label="Filter"
                        placeholder="Filter…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="h-8 w-44 pl-8 sm:w-56"
                      />
                    </div>
                    <ToggleGroup
                      aria-label="View as"
                      value={[view]}
                      onValueChange={(next: string[]) => {
                        const v = next[0];
                        // Single-select: ignore the empty array from re-clicking the active item.
                        if (v === "cards" || v === "list") chooseView(v);
                      }}
                    >
                      <ToggleGroupItem value="cards" aria-label="View as cards" title="Cards">
                        <LayoutGrid size={16} aria-hidden />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="list" aria-label="View as list" title="List">
                        <List size={16} aria-hidden />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </>
                ) : undefined
              }
              right={
                onNew ? (
                  <Button variant="outline" size="sm" onClick={onNew}>
                    <Plus size={16} aria-hidden />
                    {newLabel ?? "New"}
                  </Button>
                ) : undefined
              }
            />
          </HomeBarPortal>
        )}

        {items === null ? (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-apt-text-muted">{emptyLabel}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-apt-text-muted">No matches for “{query}”.</p>
        ) : view === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <Link
                key={getId(item)}
                href={cardHref(item)}
                className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/60"
              >
                <Card className="h-full gap-3 transition-colors group-hover:border-apt-gold/60">
                  <CardHeader>
                    <CardTitle className="text-apt-text">{getLabel(item)}</CardTitle>
                    <CardDescription className="font-mono text-xs text-apt-text-muted">
                      {getSublabel(item)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {renderMeta(item)}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-apt-border">
            {filtered.map((item, i) => (
              <li key={getId(item)}>
                <Link
                  href={cardHref(item)}
                  className={cn(
                    "flex items-center justify-between gap-4 px-4 py-3 outline-none transition-colors hover:bg-apt-surface-2 focus-visible:bg-apt-surface-2",
                    i > 0 && "border-t border-apt-border",
                  )}
                >
                  <span className="truncate text-apt-text">{getLabel(item)}</span>
                  <span className="truncate font-mono text-xs text-apt-text-muted">
                    {getSublabel(item)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
