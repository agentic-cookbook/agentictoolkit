"use client";

import type { ReactElement, ReactNode } from "react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import type { ProjectParticipant, ProjectStatus, WorkItem } from "@agentic-toolkit/data/projects";
import { priorityMeta } from "./WorkItemEditor";
import { assigneeLabel, statusMeta } from "./helpers";

/**
 * The full record of ONE work item — the details pane of the list-with-details List view.
 *
 * It READS; the row edits. The list's columns are in-place editable (title, status, assignee,
 * priority, due), so this pane's job is to show everything at once — including the fields that are
 * NOT columns and would otherwise be invisible from the list: the description, the labels, the start
 * date, the parent, and the created/updated timestamps.
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
}: {
  item: WorkItem;
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  /** The project's items, so a parent id resolves to its title rather than an opaque id. */
  workItems: WorkItem[];
}): ReactElement {
  const status = statusMeta(item.statusId, statuses);
  const priority = priorityMeta(item.priority);
  const parent = item.parentId ? workItems.find((w) => w.id === item.parentId) : null;

  return (
    <dl className="flex min-w-0 flex-col gap-3">
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
      <Row label="Priority">
        <Badge variant={priority.variant}>{priority.label}</Badge>
      </Row>
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
      <Row label="Parent">{parent ? parent.title : orDash(item.parentId)}</Row>
      <Row label="Created">{item.createdAt}</Row>
      <Row label="Updated">{item.updatedAt}</Row>
    </dl>
  );
}
