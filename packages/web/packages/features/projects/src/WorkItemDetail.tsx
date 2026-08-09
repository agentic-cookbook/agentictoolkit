"use client";

import type { ReactElement, ReactNode } from "react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { CopyButton } from "@agentic-toolkit/ui/components/copy-button";
import {
  milestoneProgress,
  type EstimateScale,
  type Iteration,
  type Milestone,
  type PriorityScale,
  type ProjectParticipant,
  type ProjectStatus,
  type WorkItem,
} from "@agentic-toolkit/data/projects";
import { priorityMeta } from "./WorkItemEditor";
import { DEFAULT_ITEM_WORDS, type ItemWords } from "./vocabulary";
import { ItemKey } from "./ItemKey";
import { WorkItemComments } from "./WorkItemComments";
import { WorkItemRelations } from "./WorkItemRelations";
import {
  assigneeLabel,
  dateLabel,
  estimateLabel,
  iterationDateRange,
  iterationStateMeta,
  itemLabel,
  statusMeta,
} from "./helpers";

/**
 * The full record of ONE work item — the details pane of the list-with-details List view.
 *
 * It READS; the row edits. The list's columns are in-place editable (title, status, assignee,
 * priority, due), so this pane's job is to show everything at once — including the fields that are
 * NOT columns and would otherwise be invisible from the list: the description, the labels, the start
 * date, the parent, and the created/updated timestamps.
 *
 * Relations and Comments are the exceptions to "it reads", and for one reason: neither is a value
 * the card HOLDS. A link is a fact about a PAIR of cards; a comment is something a person wrote
 * ABOUT the card. Neither has a cell in a row of one card's values, and no column could ever hold
 * one — so if this pane did not own them, nothing in the feature would.
 */

function Row({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex min-w-0 gap-3">
      <dt className="w-28 shrink-0 font-mono text-xs tracking-[0.02em] text-apt-text-dim">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-apt-text">{children}</dd>
    </div>
  );
}

/** An absent value reads as an em-dash rather than an empty row, so the shape stays scannable. */
function orDash(value: string | null | undefined): ReactNode {
  return value ? value : <span className="text-apt-text-dim">—</span>;
}

export function WorkItemDetail({
  item,
  statuses,
  participants,
  workItems,
  iterations,
  milestones,
  estimateScale,
  priorityScale = "standard",
  words = DEFAULT_ITEM_WORDS,
}: {
  item: WorkItem;
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  /** The project's items, so a parent id resolves to its title rather than an opaque id. */
  workItems: WorkItem[];
  /** The WORKSPACE's time-boxes, so the card's iteration id resolves to its name and dates. */
  iterations: Iteration[];
  /** THIS board's plan, so the card's milestone id resolves to its name, date and progress. No
   *  plan and no milestone on the card, no row — the same call the estimate row makes. */
  milestones: Milestone[];
  /** The owning project's scale, which is what an estimate's digits MEAN (`2` is "M" on a
   *  t-shirt board). No scale, no row — see below. */
  estimateScale: EstimateScale;
  /** The owning project's priority scale. `none` drops the row — with the same exception the
   *  Milestone row makes for an orphan: a card that was RANKED before the board turned ranking
   *  off keeps its row, because a value nothing on screen mentions cannot be corrected. */
  priorityScale?: PriorityScale;
  /** What this board calls its cards — the relations picker names them. */
  words?: ItemWords;
}): ReactElement {
  const status = statusMeta(item.statusId, statuses);
  const priority = priorityMeta(item.priority);
  const parent = item.parentId ? workItems.find((w) => w.id === item.parentId) : null;
  const iteration = item.iterationId
    ? (iterations.find((i) => i.id === item.iterationId) ?? null)
    : null;
  const milestone = item.milestoneId
    ? (milestones.find((m) => m.id === item.milestoneId) ?? null)
    : null;
  const milestoneCounts = milestone ? milestoneProgress(milestone) : null;
  const estimate = estimateLabel(item.estimate, estimateScale);

  return (
    <div className="flex min-w-0 flex-col gap-5">
    <dl className="flex min-w-0 flex-col gap-3">
      {/* First, and with a copy button: this pane is where someone lands to WRITE the key
          somewhere else — a branch name, a commit message, a PR title — so the useful act here
          is taking it away, not reading it. Rows are skipped entirely when the project has no
          prefix; an empty "Key —" row would advertise a field with nothing behind it. */}
      {item.itemKey ? (
        <Row label="Key">
          <span className="flex items-center gap-2">
            <ItemKey itemKey={item.itemKey} className="text-sm text-apt-text" />
            <CopyButton getText={() => item.itemKey} label={`Copy ${item.itemKey}`} />
          </span>
        </Row>
      ) : null}
      <Row label="Title">
        <span className="font-medium">{item.title}</span>
      </Row>
      <Row label="Description">
        {item.description ? (
          <p className="whitespace-pre-wrap">{item.description}</p>
        ) : (
          orDash(null)
        )}
      </Row>
      <Row label="Status">
        <Badge variant={status.variant}>{status.label}</Badge>
      </Row>
      <Row label="Assignee">{assigneeLabel(item, participants)}</Row>
      {priorityScale !== "none" || item.priority !== 0 ? (
        <Row label="Priority">
          <Badge variant={priority.variant}>{priority.label}</Badge>
        </Row>
      ) : null}
      {/* "Backlog" rather than a dash: a card with no iteration is not missing a value, it is in
          the one place the board puts work nobody has committed to yet. An id that resolves to
          nothing falls back to the id, the same way Parent does — better an opaque reference than
          a silent claim that the card is uncommitted. */}
      <Row label="Iteration">
        {iteration ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>{iteration.name}</span>
            <Badge variant={iterationStateMeta(iteration.state).variant}>
              {iterationStateMeta(iteration.state).label}
            </Badge>
            <span className="text-apt-text-muted">
              {iterationDateRange(iteration.startDate, iteration.endDate)}
            </span>
          </span>
        ) : item.iterationId ? (
          item.iterationId
        ) : (
          <span className="text-apt-text-dim">Backlog</span>
        )}
      </Row>
      {/* Present only where the board HAS a plan, or this card already names a point in one — an
          orphaned reference has to stay visible or it cannot be corrected. "None" rather than a
          dash for the same reason Iteration says "Backlog": counting toward no delivery is an
          ordinary answer, not a missing value. The card counts read off the milestone's own
          server-side totals, so this row says the same thing the Milestones pane does. */}
      {milestones.length > 0 || item.milestoneId ? (
        <Row label="Milestone">
          {milestone ? (
            <span className="flex flex-wrap items-center gap-2">
              <span>{milestone.name}</span>
              {milestone.targetDate ? (
                <span className="text-apt-text-muted">{dateLabel(milestone.targetDate)}</span>
              ) : null}
              {milestoneCounts ? (
                <span className="text-apt-text-muted">
                  {milestoneCounts.done}/{milestoneCounts.total} done
                </span>
              ) : null}
            </span>
          ) : item.milestoneId ? (
            item.milestoneId
          ) : (
            <span className="text-apt-text-dim">None</span>
          )}
        </Row>
      ) : null}
      {/* Omitted entirely on a project that does not estimate — an "Estimate —" row on such a
          board advertises a field that has no picker anywhere and can never be filled in. */}
      {estimateScale !== "none" ? <Row label="Estimate">{orDash(estimate)}</Row> : null}
      <Row label="Start">{orDash(item.startDate)}</Row>
      <Row label="Due">{orDash(item.dueDate)}</Row>
      <Row label="Labels">
        {item.labels.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {item.labels.map((l) => (
              <Badge key={l} variant="neutral">
                {l}
              </Badge>
            ))}
          </span>
        ) : (
          orDash(null)
        )}
      </Row>
      {/* Named by key AND title — a parent is the one cross-reference on this pane, and a
          cross-reference is exactly what a key is for. */}
      <Row label="Parent">{parent ? itemLabel(parent) : orDash(item.parentId)}</Row>
      <Row label="Created">{item.createdAt}</Row>
      <Row label="Updated">{item.updatedAt}</Row>
    </dl>
      {/* Outside the <dl>, because neither is a term/description pair: one is a list of other
          cards and one is a conversation, each with its own controls. Comments come LAST because
          they grow without bound — the card's own facts must not be pushed off the top of the
          pane by a long thread. */}
      <WorkItemRelations item={item} statuses={statuses} workItems={workItems} words={words} />
      <WorkItemComments workItemId={item.id} />
    </div>
  );
}
