"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Button } from "@agentic-toolkit/ui/components/button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { ListChooser, type ListChooserItem } from "@agentic-toolkit/ui/components/list-chooser";
import { Select } from "@agentic-toolkit/ui/components/select";
import { useResourceList } from "@agentic-toolkit/data";
import {
  projectWorkItemsApi,
  type ProjectStatus,
  type RelationKind,
  type WorkItem,
  type WorkItemRelation,
} from "@agentic-toolkit/data/projects";
import { ItemKey } from "./ItemKey";
import { RELATION_CHOICES, itemLabel, relationLabel, statusMeta } from "./helpers";

/**
 * HOW THIS CARD IS LINKED TO OTHERS — the relations section of the work-item detail pane.
 *
 * A relation is the one part of a card's record with no cell anywhere else: the list has a
 * column for every scalar and none for this, because a link is not a value the card holds, it is
 * a fact about a PAIR. So this is where it is both read and made.
 *
 * Each row is phrased from the card in front of you (`relationLabel`), never from the stored
 * edge — the same row reads "Blocked by" on one card and "Blocks" on the other, and a reader
 * should never have to work out which end they are standing on. Adding always files an OUTGOING
 * link, so the kind chooser offers only the outgoing phrasings; the inverse turns up by itself
 * on the other card.
 *
 * Follows the attach idiom of the sibling Contents pane — a couple of fields, an Add button, and
 * a per-row ghost Trash2 with no confirm — for the same reason it holds there: unlinking removes
 * a claim about two cards, never either card, so a confirm would overstate what is at stake.
 */

/** Sort key so the list groups by relationship instead of by the order links happened to be
 *  made. Within a kind the server's `createdAt` order survives, because `sort` is stable. */
const KIND_ORDER: Record<RelationKind, number> = {
  depends_on: 0,
  relates_to: 1,
  duplicates: 2,
};

/** One link, described from the near card's end: what the relationship is, which card is at the
 *  far end, where that card stands, and the way to undo it. */
function RelationRow({
  relation,
  statuses,
  onUnlink,
  unlinking,
}: {
  relation: WorkItemRelation;
  statuses: ProjectStatus[];
  onUnlink: () => void;
  unlinking: boolean;
}): ReactElement {
  const status = statusMeta(relation.status, statuses);
  const label = relationLabel(relation.kind, relation.direction);
  return (
    <ListItem className="justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {/* The relationship carries no tone: neutral, because "Blocked by" is a fact about the
            pair, not a judgement about either card. The STATUS badge is the coloured one. */}
        <Badge variant="neutral">{label}</Badge>
        <ItemKey itemKey={relation.relatedKey} />
        <span className="truncate text-sm text-apt-text">{relation.title}</span>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Unlink ${itemLabel({ itemKey: relation.relatedKey, title: relation.title })}`}
        disabled={unlinking}
        onClick={onUnlink}
      >
        <Trash2 />
      </Button>
    </ListItem>
  );
}

export function WorkItemRelations({
  item,
  statuses,
  workItems,
}: {
  item: WorkItem;
  statuses: ProjectStatus[];
  /** The project's items — the candidates a link can be made to. */
  workItems: WorkItem[];
}): ReactElement {
  const [kind, setKind] = useState<RelationKind>("depends_on");
  const [pick, setPick] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  // Guards the link/unlink BUSY flags only; the list's own out-of-order and after-unmount
  // handling belongs to useResourceList below.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Keyed by the ITEM, so moving the selection in the list swaps to that card's links rather
  // than showing the previous card's while the new ones load.
  const load = useCallback(
    () => projectWorkItemsApi.relations.list(item.id),
    [item.id],
  );
  const {
    items: relations,
    reload,
    error: loadError,
  } = useResourceList<WorkItemRelation>(`work-item:${item.id}:relations`, load);

  // A card cannot link to itself, and a pair holds ONE relation — so a card already linked is
  // not a candidate either. Offering it would produce a 409 the person could have been spared,
  // and the existing link is already on screen right above the chooser. While the read is still
  // outstanding nothing is known to be linked, so every other card is offered; the backend is
  // the one that refuses, which is why that check is not merely cosmetic here.
  const linked = new Set((relations ?? []).map((r) => r.relatedId));
  const candidates: ListChooserItem[] = workItems
    .filter((w) => w.id !== item.id && !linked.has(w.id))
    .map((w) => ({ value: w.id, label: itemLabel(w) }));

  const ordered = [...(relations ?? [])].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );

  async function link(): Promise<void> {
    if (!pick) return;
    setLinking(true);
    setWriteError(null);
    try {
      await projectWorkItemsApi.relations.add(item.id, pick, kind);
      setPick(null);
      // The reload's own promise rejects on failure; the hook has already surfaced it as
      // `loadError`, so there is nothing left for this caller to do with it.
      await reload().catch(() => {});
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : "Failed to link.");
    } finally {
      if (mounted.current) setLinking(false);
    }
  }

  async function unlink(relation: WorkItemRelation): Promise<void> {
    setUnlinkingId(relation.id);
    setWriteError(null);
    try {
      // Addressed by the far CARD, not by the edge id: a pair holds one relation, so naming the
      // other card names the link — and it works from whichever end you are standing on.
      await projectWorkItemsApi.relations.remove(item.id, relation.relatedId);
      await reload().catch(() => {});
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : "Failed to unlink.");
    } finally {
      if (mounted.current) setUnlinkingId(null);
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label="Relations">
      <h3 className="font-mono text-xs tracking-[0.02em] text-apt-text-dim">Relations</h3>
      <ErrorText error={loadError} />
      <ErrorText error={writeError} />
      {relations === null ? (
        // Only while the read is genuinely outstanding: with the error above, "Loading…" is a
        // promise the section is not keeping, and "Not linked to anything yet" would assert a
        // fact it does not have.
        loadError ? null : (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        )
      ) : ordered.length > 0 ? (
        <List>
          {ordered.map((r) => (
            <RelationRow
              key={r.id}
              relation={r}
              statuses={statuses}
              onUnlink={() => void unlink(r)}
              unlinking={unlinkingId === r.id}
            />
          ))}
        </List>
      ) : (
        // A plain line rather than an EmptyState block: this section sits inside a details pane
        // that is already a dense list of rows, and a bordered empty panel would read as the
        // loudest thing on it.
        <p className="text-sm text-apt-text-muted">Not linked to anything yet.</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Relationship" className="w-40">
          <Select
            value={kind}
            onChange={(e) => {
              setWriteError(null);
              setKind(e.target.value as RelationKind);
            }}
          >
            {RELATION_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Work item" className="min-w-48 flex-1">
          <ListChooser
            items={candidates}
            value={pick}
            // Nothing here can be CREATED by picking it — a link needs a card that already
            // exists, so typed text matching nothing is not an entry to add.
            allowCreate={false}
            onChange={(value) => {
              setWriteError(null);
              setPick(value);
            }}
            // The accessible name matches the Field's visible caption on purpose — the
            // trigger's aria-label overrides the wrapping Label, so letting the two say
            // different things is how a control ends up unaddressable by its own caption.
            ariaLabel="Work item"
            inputLabel="Filter work items"
            triggerPlaceholder="Choose an item…"
            placeholder="Filter…"
            emptyLabel="Nothing left to link"
          />
        </Field>
        <Button
          variant="secondary"
          disabled={!pick || linking}
          onClick={() => void link()}
        >
          Link
        </Button>
      </div>
    </section>
  );
}
