"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { AlertModal } from "@agenticdevelopertoolkit/ui/components/alert-modal";
import { Badge } from "@agenticdevelopertoolkit/ui/components/badge";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { Field } from "@agenticdevelopertoolkit/ui/blocks/field";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { Textarea } from "@agenticdevelopertoolkit/ui/components/textarea";
import { readTokenSubject, useResourceList } from "@agentic-toolkit/data";
import {
  projectStatusUpdatesApi,
  type ProjectHealth,
  type ProjectParticipant,
  type ProjectStatusUpdate,
} from "@agentic-toolkit/data/projects";
import { participantLabel } from "./AssigneePicker";
import { PROJECT_HEALTHS, healthMeta, relativeTime } from "./helpers";

/**
 * THE BOARD'S CHECK-INS — the signed reports a project's health is read from.
 *
 * A sibling of {@link WorkItemComments}, and modelled on it deliberately: both are someone's
 * writing rather than a value the record holds, so both can be revised and withdrawn where an
 * ordinary field is simply overwritten. The difference is the consequence. A comment is prose. A
 * status update MOVES A DASHBOARD — the backend derives `Project.health` from the newest live
 * report and stores no column for it, so posting, revising, or retracting one changes what the
 * project says about itself. That is why `onChanged` exists and why every write here calls it:
 * this section does not own the health, so it refetches the project rather than patching a field
 * it has no claim to.
 *
 * WHO MAY DO WHAT — the comment rule, restated because the reasons differ slightly:
 *   • REVISE is the author's alone, and knowable here (the row carries `createdBy`,
 *     `readTokenSubject()` is the viewer), so the control simply is not rendered for anyone else.
 *     Rewriting someone else's report over their signature would be a forgery, and this one would
 *     additionally move a number other people are steering by.
 *   • RETRACT is the author's OR anyone holding the project's sub-item delete verb — which the
 *     client cannot know, because reach is computed server-side from roles it never sees. It is
 *     therefore offered on every row and a refusal is surfaced as an error, the same way round as
 *     on a comment and for the same reason: the common case is that a reader may act.
 *
 * Both halves of a report are required, which is the backend's rule and a good one: a health with
 * no explanation is a colour nobody can act on, and prose with no health does not move anything.
 */

/** A report is submitted with ⌘/Ctrl+Enter, never bare Enter — the body is prose, so a plain
 *  Enter has to stay available for a new paragraph. Same chord as the comment composer's. */
function isSubmitChord(e: React.KeyboardEvent): boolean {
  return e.key === "Enter" && (e.metaKey || e.ctrlKey);
}

/**
 * Who signed a report.
 *
 * The row carries a bare actor id, so this resolves it against the roster the pane already has —
 * the same names the assignee picker offers, phrased identically, so one person is not named two
 * different ways on one screen. An id that matches nobody is ECHOED rather than replaced with
 * "Someone": a reporter who has since left the project is still a specific person, and hiding
 * which one would make an old report unattributable.
 */
function reporterText(
  update: ProjectStatusUpdate,
  participants: ProjectParticipant[],
): string {
  if (!update.createdBy) return "Someone";
  const match = participants.find((p) => p.participantId === update.createdBy);
  return match ? participantLabel(match) : update.createdBy;
}

/** The health picker — a native Select, because the set is CLOSED and three items long. A
 *  typeahead over three options would be a worse control, not a fancier one. */
function HealthField({
  value,
  onChange,
  disabled,
  label,
}: {
  value: ProjectHealth;
  onChange: (next: ProjectHealth) => void;
  disabled: boolean;
  label: string;
}): ReactElement {
  return (
    <Field label={label} className="min-w-44">
      <Select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ProjectHealth)}
      >
        {PROJECT_HEALTHS.map((h) => (
          <option key={h} value={h}>
            {healthMeta(h).label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** The composer — the new-report box and the edit box over an existing one are the same control,
 *  differing only in wording and in what they start out holding. */
function UpdateComposer({
  label,
  health,
  onHealthChange,
  body,
  onBodyChange,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
  autoFocus,
}: {
  label: string;
  health: ProjectHealth;
  onHealthChange: (next: ProjectHealth) => void;
  body: string;
  onBodyChange: (next: string) => void;
  onSubmit: () => void;
  /** Present on the edit box, which is dismissable; absent on the always-open composer. */
  onCancel?: () => void;
  submitLabel: string;
  busy: boolean;
  autoFocus?: boolean;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <HealthField value={health} onChange={onHealthChange} disabled={busy} label="Health" />
      <Textarea
        value={body}
        rows={3}
        aria-label={label}
        placeholder={`${label}…`}
        disabled={busy}
        autoFocus={autoFocus}
        onChange={(e) => onBodyChange(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitChord(e)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={busy || !body.trim()} onClick={onSubmit}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ProjectStatusUpdates({
  projectId,
  participants,
  onChanged,
}: {
  projectId: string;
  /** The board's roster, for putting a name to a report's signature. Already loaded by the pane
   *  that mounts this, so it is passed rather than fetched twice. */
  participants: ProjectParticipant[];
  /** Re-read the PROJECT after any write. Every one of the three moves its health, and this
   *  section does not own that field — see the header. */
  onChanged: () => void;
}): ReactElement {
  // The composer starts on the least alarming answer, which is also the first one offered: a
  // mis-click should not raise an alarm nobody meant to raise.
  const [draftHealth, setDraftHealth] = useState<ProjectHealth>("on_track");
  const [draftBody, setDraftBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHealth, setEditHealth] = useState<ProjectHealth>("on_track");
  const [editBody, setEditBody] = useState("");
  const [removing, setRemoving] = useState<ProjectStatusUpdate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  // Guards the write BUSY flags only; the list's own out-of-order and after-unmount handling
  // belongs to useResourceList.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const viewerId = readTokenSubject();

  const load = useCallback(() => projectStatusUpdatesApi.list(projectId), [projectId]);
  const {
    items: updates,
    reload,
    error: loadError,
  } = useResourceList<ProjectStatusUpdate>(`project:${projectId}:status-updates`, load);

  /** Every write here is the same shape: clear the last error, run it, refresh BOTH this list and
   *  the project whose health just moved, and report a failure in words the section can show. */
  async function write(id: string | null, fallback: string, op: () => Promise<void>): Promise<boolean> {
    setWriteError(null);
    setBusyId(id);
    if (id === null) setPosting(true);
    try {
      await op();
      // The reload's own promise rejects on failure; the hook has already surfaced it as
      // `loadError`, so there is nothing left for this caller to do with it.
      await reload().catch(() => {});
      onChanged();
      return true;
    } catch (e) {
      if (mounted.current) setWriteError(e instanceof Error ? e.message : fallback);
      return false;
    } finally {
      if (mounted.current) {
        setBusyId(null);
        setPosting(false);
      }
    }
  }

  async function post(): Promise<void> {
    const body = draftBody.trim();
    if (!body || posting) return;
    const ok = await write(null, "Failed to post the update.", async () => {
      await projectStatusUpdatesApi.create(projectId, { health: draftHealth, body });
    });
    if (ok && mounted.current) setDraftBody("");
  }

  async function saveEdit(update: ProjectStatusUpdate): Promise<void> {
    const body = editBody.trim();
    if (!body) return;
    const ok = await write(update.id, "Failed to save the update.", async () => {
      await projectStatusUpdatesApi.update(projectId, update.id, {
        health: editHealth,
        body,
      });
    });
    if (ok && mounted.current) setEditingId(null);
  }

  async function remove(update: ProjectStatusUpdate): Promise<void> {
    await write(update.id, "Failed to retract the update.", async () => {
      await projectStatusUpdatesApi.remove(projectId, update.id);
    });
    if (mounted.current) setRemoving(null);
  }

  function startEdit(update: ProjectStatusUpdate): void {
    setWriteError(null);
    setEditingId(update.id);
    setEditHealth(update.health);
    setEditBody(update.body);
  }

  // The FIRST row is the one the project's health is read from — worth saying on the row rather
  // than leaving a reader to infer it from the ordering, because it is what makes retracting the
  // top report consequential and retracting an older one harmless.
  const currentId = updates && updates.length > 0 ? updates[0]!.id : null;

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Status updates">
      <h3 className="font-mono text-xs tracking-[0.02em] text-apt-text-dim">Status updates</h3>
      <ErrorText error={loadError} />
      <ErrorText error={writeError} />

      <UpdateComposer
        label="Report how this project is going"
        health={draftHealth}
        onHealthChange={(h) => {
          setWriteError(null);
          setDraftHealth(h);
        }}
        body={draftBody}
        onBodyChange={(next) => {
          setWriteError(null);
          setDraftBody(next);
        }}
        onSubmit={() => void post()}
        submitLabel="Post update"
        busy={posting}
      />

      {updates === null ? (
        // Only while the read is genuinely outstanding: with the error above, "Loading…" is a
        // promise the section is not keeping, and "No updates yet" would assert a fact it does
        // not have.
        loadError ? null : (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        )
      ) : updates.length === 0 ? (
        <p className="text-sm text-apt-text-muted">
          No updates yet — this project has no reported health.
        </p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-4">
          {updates.map((u) => {
            const meta = healthMeta(u.health);
            const who = reporterText(u, participants);
            const mine = viewerId !== null && u.createdBy === viewerId;
            const busy = busyId === u.id;
            return (
              <li key={u.id} className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <span className="text-sm font-medium text-apt-text">{who}</span>
                  <time dateTime={u.createdAt} className="text-xs text-apt-text-dim">
                    {relativeTime(u.createdAt)}
                  </time>
                  {u.id === currentId ? (
                    <span className="text-xs text-apt-text-dim">· the project's health now</span>
                  ) : null}
                </div>

                {editingId === u.id ? (
                  <UpdateComposer
                    label={`Revise ${who}'s update`}
                    health={editHealth}
                    onHealthChange={setEditHealth}
                    body={editBody}
                    onBodyChange={setEditBody}
                    onSubmit={() => void saveEdit(u)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Save"
                    busy={busy}
                    autoFocus
                  />
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm text-apt-text">
                      {u.body}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      {mine ? (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Revise ${who}'s update`}
                          disabled={busy}
                          onClick={() => startEdit(u)}
                        >
                          <Pencil />
                        </Button>
                      ) : null}
                      <Button
                        variant="destructive-ghost"
                        size="icon-xs"
                        aria-label={`Retract ${who}'s update`}
                        disabled={busy}
                        onClick={() => setRemoving(u)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Retracting a report withdraws a claim other people are steering by, and when it is the
          newest one it also rolls the project's health BACK to whatever the previous report said.
          The modal says which of those two it is about to do, because the difference is the whole
          question. `destructive` alone carries the rest of the policy (error tone, red action,
          cancel-first focus, no Enter-to-confirm), so nothing below restates a piece of it. */}
      <AlertModal
        open={removing !== null}
        title="Retract this update?"
        description={
          removing
            ? removing.id === currentId
              ? `${reporterText(removing, participants)}'s update will no longer be shown, and this project's health goes back to whatever the previous update reported — or to none, if there is no earlier one.`
              : `${reporterText(removing, participants)}'s update will no longer be shown. This project's health is read from the newest update, so it does not change.`
            : undefined
        }
        destructive
        confirmLabel="Retract"
        cancelLabel="Keep"
        busy={removing !== null && busyId === removing.id}
        onConfirm={() => {
          if (removing) void remove(removing);
        }}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
