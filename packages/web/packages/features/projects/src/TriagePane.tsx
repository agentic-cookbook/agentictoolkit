"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { Inbox } from "lucide-react";
import { Badge } from "@agenticdevelopertoolkit/ui/components/badge";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { Card, CardContent } from "@agenticdevelopertoolkit/ui/components/card";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { Field } from "@agenticdevelopertoolkit/ui/blocks/field";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { TopicSelectHint } from "@agenticdevelopertoolkit/ui/blocks";
import { useResourceItemQuery, useResourceList } from "@agentic-toolkit/data";
import {
  projectIterationsApi,
  projectMilestonesApi,
  projectTriageApi,
  projectsApi,
  type EstimateScale,
  type Iteration,
  type Milestone,
  type Project,
  type ProjectParticipant,
  type ProjectStatus,
  type TriageAcceptBody,
  type WorkItem,
} from "@agentic-toolkit/data/projects";
import { DetailSection, FeatureTitle, useStackLevel, type TopicLeaf } from "@agentic-toolkit/resource";
import { AssigneePicker, type AssigneeValue } from "./AssigneePicker";
import { EstimatePicker, NO_ESTIMATE, fromEstimateValue } from "./EstimatePicker";
import { IterationPicker, NO_ITERATION } from "./IterationPicker";
import { MilestonePicker, NO_MILESTONE } from "./MilestonePicker";
import { ItemKey } from "./ItemKey";
import { relativeTime, statusMeta } from "./helpers";
import { DEFAULT_ITEM_WORDS, itemWordsOf, type ItemWords } from "./vocabulary";

/**
 * TRIAGE — the queue of cards nobody has accepted onto this board yet.
 *
 * A card is in the queue when its `triagedAt` is null, and that is the whole mechanism. It is a
 * timestamp rather than a sixth column category because "waiting to be looked at" is not a column
 * of a board — it is a statement about whether the board's columns apply to this card at all. The
 * timestamp also answers the question a queue is actually worked by: how long has this been here.
 *
 * These are exactly the cards the Work Items surface does NOT show. Leaving them on the board
 * would put each one in whatever column it happened to be filed into, which is precisely the claim
 * the inbox exists to withhold — so the two lists partition the board and this pane is the other
 * half.
 *
 * NOT A MASTER/DETAIL EDITOR, unlike its neighbours, and the difference is real rather than
 * stylistic. A queue's verb is a DECISION, not an edit: you accept a card onto the board (with the
 * placement decided in the same breath) or you decline it. There is no draft to lose — abandoning
 * a half-made decision leaves the card exactly where it was — so there is no unsaved-work guard
 * here, and the buttons say what they do instead of saying "Save".
 *
 * DECLINING IS ACCEPTING INTO A CANCELED COLUMN. There is no second verb and no delete: a declined
 * card stays findable and says what happened to it, which a deletion answers neither of. The button
 * is therefore absent — not disabled-with-a-shrug — on a board with no canceled column, because
 * there is nowhere honest to put the card.
 */

/* ── The placement being decided ──────────────────────────────────────────── */

interface Placement {
  statusId: string;
  assignee: AssigneeValue | null;
  /** the milestone's id, or {@link NO_MILESTONE} — the picker's own vocabulary, not a nullable id,
   *  so the control here is fed exactly what the card's own editor feeds it. Same for the two
   *  below. */
  milestoneId: string;
  iterationId: string;
  estimate: string;
}

function blankPlacement(statusId: string): Placement {
  return {
    statusId,
    assignee: null,
    milestoneId: NO_MILESTONE,
    iterationId: NO_ITERATION,
    estimate: NO_ESTIMATE,
  };
}

/** The placement as the accept body. Everything unset is OMITTED rather than nulled: the accept
 *  route patches through the ordinary work-item writer, where an explicit null CLEARS a field —
 *  and clearing what the intake already filled in is the opposite of what "I didn't say" means. */
function toAcceptBody(p: Placement, override?: { statusId: string }): TriageAcceptBody {
  const statusId = override?.statusId ?? p.statusId;
  const estimate = fromEstimateValue(p.estimate);
  return {
    ...(statusId ? { statusId } : {}),
    // The kind is narrowed by construction: every option the picker offers came off this board's
    // participant roster, whose kind column IS the accept body's enum.
    ...(p.assignee
      ? {
          assigneeKind: p.assignee.assigneeKind as TriageAcceptBody["assigneeKind"],
          assigneeId: p.assignee.assigneeId,
        }
      : {}),
    ...(p.milestoneId === NO_MILESTONE ? {} : { milestoneId: p.milestoneId }),
    ...(p.iterationId === NO_ITERATION ? {} : { iterationId: p.iterationId }),
    ...(estimate === null ? {} : { estimate }),
  };
}

/* ── The decision ─────────────────────────────────────────────────────────── */

/**
 * ONE queued card, and the decision to be made about it.
 *
 * The card is shown READ-ONLY. Editing a card that has not been accepted yet is the wrong order of
 * operations — the question on this screen is whether it belongs here, and its title and body are
 * the evidence for that, not the subject of it. Once accepted, its own editor opens on the board
 * with everything on it.
 */
function TriageDecision({
  item,
  statuses,
  participants,
  milestones,
  iterations,
  estimateScale,
  words = DEFAULT_ITEM_WORDS,
  onAccepted,
}: {
  item: WorkItem;
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  milestones: Milestone[];
  iterations: Iteration[];
  estimateScale: EstimateScale;
  /** What THIS board calls its cards. The queue holds one board's intake, so it speaks that
   *  board's word — unlike the cross-board queue, which spans boards that disagree. */
  words?: ItemWords;
  /** The card left the queue — the pane refreshes and clears the selection. */
  onAccepted: (accepted: WorkItem) => void;
}): ReactElement {
  // The column a card LANDS in by default is the board's first, not the one the intake happened to
  // file it into: the filed column is an accident of whatever created the card, and presenting it
  // as a decision already made is what the inbox exists to prevent.
  const defaultStatusId = statuses[0]?.id ?? "";
  const [placement, setPlacement] = useState<Placement>(() => blankPlacement(defaultStatusId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new card, or the columns arriving after this mounted: re-arm the default. Keyed on both, so
  // switching rows never carries the previous card's half-made decision onto the next one.
  useEffect(() => {
    setPlacement(blankPlacement(defaultStatusId));
    setError(null);
  }, [item.id, defaultStatusId]);

  // The column that MEANS declined. The first `canceled` one, in board order — a board with two of
  // them has said the earlier is the ordinary one.
  const declineStatus = statuses.find((s) => s.category === "canceled") ?? null;

  async function decide(override?: { statusId: string }): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      onAccepted(await projectTriageApi.accept(item.id, toAcceptBody(placement, override)));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to accept this ${words.one}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailSection title={`The ${words.one}`}>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ItemKey itemKey={item.itemKey} />
              <span className="text-sm text-apt-text-muted">
                Filed {relativeTime(item.createdAt)}
              </span>
            </div>
            <h3 className="text-base text-apt-text">{item.title}</h3>
            {item.description ? (
              <p className="whitespace-pre-wrap text-sm text-apt-text-muted">
                {item.description}
              </p>
            ) : (
              <p className="text-sm text-apt-text-dim">No description.</p>
            )}
            {item.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.labels.map((l) => (
                  <Badge key={l}>{l}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </DetailSection>

      <DetailSection title="Accept onto the board">
        <Card>
          <CardContent className="flex flex-col gap-5">
            <Field
              label="Column"
              hint="Where it lands. Defaults to the board's first column, not the one it was filed into."
            >
              <Select
                value={placement.statusId}
                onChange={(e) => setPlacement({ ...placement, statusId: e.target.value })}
              >
                {statuses.length === 0 && <option value="">Default</option>}
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>

            {/* The rest are optional and the same controls the card's own editor uses, so a
                decision made here is made with the vocabulary the board already speaks. Each
                renders nothing when the board has none of its kind — see the pickers. */}
            <AssigneePicker
              participants={participants}
              value={placement.assignee}
              onChange={(assignee) => setPlacement({ ...placement, assignee })}
            />
            <MilestonePicker
              milestones={milestones}
              value={placement.milestoneId}
              onChange={(milestoneId) => setPlacement({ ...placement, milestoneId })}
            />
            <IterationPicker
              iterations={iterations}
              value={placement.iterationId}
              onChange={(iterationId) => setPlacement({ ...placement, iterationId })}
            />
            <EstimatePicker
              scale={estimateScale}
              value={placement.estimate}
              onChange={(estimate) => setPlacement({ ...placement, estimate })}
            />

            <ErrorText error={error} />

            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={busy} onClick={() => void decide()}>
                Accept onto the board
              </Button>
              {/* Absent, not disabled, when the board has no canceled column: there would be
                  nowhere honest to put a declined card, and a greyed button implies one exists. */}
              {declineStatus && (
                <Button
                  variant="warning"
                  disabled={busy}
                  onClick={() => void decide({ statusId: declineStatus.id })}
                >
                  Decline to {declineStatus.label}
                </Button>
              )}
              <span className="text-sm text-apt-text-muted">
                {declineStatus
                  ? `Declining keeps the ${words.one}, in a canceled column — it never disappears.`
                  : "This board has no canceled column, so there is nowhere to file a decline."}
              </span>
            </div>
          </CardContent>
        </Card>
      </DetailSection>
    </div>
  );
}

/* ── The pane ─────────────────────────────────────────────────────────────── */

export function TriagePane({
  projectId,
  title,
  leaf,
  workspaceSlug,
}: {
  projectId: string;
  title: string;
  /** The deep-linkable selection — which queued card is open (`…/triage/<id>`). */
  leaf: TopicLeaf;
  /** The workspace, for the iteration list (cycles belong to the workspace, not the board). */
  workspaceSlug?: string;
}): ReactElement {
  const loadQueue = useCallback(() => projectTriageApi.listForProject(projectId), [projectId]);
  const loadStatuses = useCallback(
    () => projectsApi.statuses.list(projectId).catch(() => [] as ProjectStatus[]),
    [projectId],
  );
  const loadParticipants = useCallback(
    () => projectsApi.participants.list(projectId),
    [projectId],
  );
  const loadMilestones = useCallback(
    () => projectMilestonesApi.list(projectId),
    [projectId],
  );
  const loadIterations = useCallback(
    () => projectIterationsApi.list({ workspace: workspaceSlug }),
    [workspaceSlug],
  );

  const {
    items: queue,
    reload,
    error: loadError,
    isFetching: fetchingQueue,
  } = useResourceList<WorkItem>(`project:${projectId}:triage`, loadQueue);
  // The SAME cache keys the board fills, so nothing here re-reads what the Work Items surface has
  // already loaded, and a column renamed there is what this offers.
  const { items: statusRows } = useResourceList<ProjectStatus>(
    `project:${projectId}:statuses`,
    loadStatuses,
  );
  const { items: participantRows } = useResourceList<ProjectParticipant>(
    `project:${projectId}:participants`,
    loadParticipants,
  );
  const { items: milestoneRows } = useResourceList<Milestone>(
    `project:${projectId}:milestones`,
    loadMilestones,
  );
  const { items: iterationRows } = useResourceList<Iteration>(
    `workspace:${workspaceSlug ?? ""}:iterations`,
    loadIterations,
  );

  const rows = useMemo(() => queue ?? [], [queue]);
  const statuses = statusRows ?? [];

  // The board's own SETTINGS: what an estimate's digits mean here, and what it calls its cards.
  // Both fall back while the record is outstanding, and each falls back to its own safe side —
  // `none` so the estimate picker appears when the board is KNOWN to estimate rather than flashing
  // on one that does not, and the default noun because the rail is titled before the read lands
  // and a title that changes under the reader is worse than one that was never renamed.
  //
  // Read from the SAME cache entry the Overview and the board read, so the queue's vocabulary is
  // right on the first frame whenever either has been open — and a rename saved in Settings is
  // already in this entry before the queue is opened, because that save writes its answer here.
  const { item: project } = useResourceItemQuery<Project | null>(
    "project:projects",
    projectId,
    projectsApi.get,
  );
  const estimateScale: EstimateScale = project?.estimateScale ?? "none";
  const words = itemWordsOf(project);

  const selected = rows.find((r) => r.id === leaf.leafId) ?? null;

  // PUBLISH the queue as a deeper rail level. Oldest first, which the server already orders and
  // this must not re-sort: the end that has been waiting longest is the end a queue is worked from.
  useStackLevel({
    id: "project-triage-list",
    title: "Triage",
    items: rows.map((r) => ({
      id: r.id,
      label: r.title,
      // The AGE first, because it is what decides which card to open — the column it was filed
      // into is context, and deliberately the smaller half of the line. `statusMeta` renders an
      // unknown id as "—" rather than blanking, so this line is never half-written.
      sublabel: `Filed ${relativeTime(r.createdAt)} · ${statusMeta(r.statusId, statuses).label}`,
      icon: <Inbox size={16} aria-hidden />,
    })),
    selectedId: leaf.leafId,
    onSelect: (id) => leaf.onSelect(id),
    onClear: () => leaf.onSelect(null),
    // The spinner in front of "Triage". The QUEUE's read is the whole of it here, and that is not
    // a gap: this list's selected row has no body of its own to fetch — a decision is taken
    // against the row already in `rows` — so the queue read is the only read this column makes.
    // It covers the reload after every accept/decline, which is exactly when the column is
    // catching up and the cached rows on screen are one decision out of date.
    busy: fetchingQueue,
    emptyLabel: queue === null ? "Loading…" : "Nothing waiting — the inbox is clear.",
    itemNoun: words.one,
    overviewHelp: `${words.manyCap} filed into this board but not yet accepted onto it. Open one to place it, or decline it.`,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <FeatureTitle title={title} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        <ErrorText error={loadError} />
        {selected ? (
          <TriageDecision
            key={selected.id}
            item={selected}
            statuses={statuses}
            participants={participantRows ?? []}
            milestones={milestoneRows ?? []}
            iterations={iterationRows ?? []}
            estimateScale={estimateScale}
            words={words}
            onAccepted={() => {
              // It has left the queue, so the selection it was pointing at is gone: clear the leaf
              // BEFORE the refetch, or the pane spends a frame selecting a row that no longer
              // exists. The board's own list is refetched by whoever mounts it next — its cache
              // key is not this pane's to invalidate.
              leaf.onSelect(null);
              void reload();
            }}
          />
        ) : (
          <TopicSelectHint
            title={
              queue === null
                ? "Loading…"
                : rows.length === 0
                  ? "Nothing is waiting to be triaged."
                  : `Select a ${words.one} to place it on the board.`
            }
          />
        )}
      </div>
    </div>
  );
}
