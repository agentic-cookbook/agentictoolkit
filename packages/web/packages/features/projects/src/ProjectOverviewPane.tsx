"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Activity, FileStack, ListTodo, Trash2, Users } from "lucide-react";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { Select } from "@agentic-toolkit/ui/components/select";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Disclosure } from "@agentic-toolkit/ui/components/disclosure";
import { InfoPanel } from "@agentic-toolkit/ui/blocks/info-panel";
import { StatCard } from "@agentic-toolkit/ui/blocks/stat-card";
import { StatList, StatListRow } from "@agentic-toolkit/ui/blocks/stat-list";
import { isConflict, useResourceList } from "@agentic-toolkit/data";
import {
  projectsApi,
  projectWorkItemsApi,
  projectArtifactsApi,
  projectActivityApi,
  type Project,
  type ProjectActivity,
  type ProjectArtifact,
  type ProjectParticipant,
  type ProjectStatus,
  type WorkItem,
} from "@agentic-toolkit/data/projects";
import { FeatureTitle, useRecordAffordance } from "@agentic-toolkit/resource";
import {
  actionPhrase,
  actorText,
  categoryVariant,
  commentBody,
  dayIndex,
  relativeTime,
  todayIndex,
  type BadgeVariant,
} from "./helpers";

/**
 * WHAT THE PROJECT IS — the Overview topic.
 *
 * A project is a PLACE, and this is its front door: what it is about, how much work is in it and
 * where that work stands, what material it holds, who is in it, and what has happened lately.
 * Everything here is a SUMMARY with a home elsewhere in the rail — Work Items, Contents, Activity
 * — so the reading is "here is the state of this place, and the rail is how you go into it". The
 * rail is the navigation; no panel here duplicates it as a link, which is how every other pane in
 * this package behaves.
 *
 * The pane used to be its settings form, which made the first thing you saw when you opened a
 * project a text box for renaming it. The form is still here in full, demoted into a closed
 * Disclosure near the bottom: editing a project's own record is a rare, deliberate act, and it was
 * crowding out the ninety per cent of visits that are asking how the project is doing.
 *
 * Every figure is derived CLIENT-SIDE from the same lists the other topics load, through the
 * shared `useResourceList` on the SAME cache keys — so opening Overview warms Work Items and
 * Contents (and vice versa) instead of re-fetching, and there is no summary endpoint to keep in
 * agreement with the lists it summarises.
 *
 * It renders its content inline (rather than publishing a stack level), so it slots straight into
 * the ResourceExplorer Overview topic pane and a plain render exercises it in tests.
 *
 * Note: the project's own `status` is a FREE-FORM lifecycle varchar (e.g. "active") with no
 * backend enum guard — a different axis from the per-project work-item board columns
 * (`statuses.list`). So it edits as a free-text Input, not a Select over the board columns (which
 * would mislabel the project with a column key like "todo").
 */

/** How many activity rows the summary shows. Enough to answer "is anything happening here", short
 *  enough that the Activity topic is still where you go to actually read the trail. */
const RECENT_ACTIVITY = 5;

/* ── Participant kind → Badge tone ────────────────────────────────────────── */
function kindVariant(kind: ProjectParticipant["participantKind"]): BadgeVariant {
  switch (kind) {
    case "customer":
      return "blue";
    case "persona":
      return "accent";
    case "team":
      return "orange";
    default:
      return "neutral";
  }
}

const KINDS: ProjectParticipant["participantKind"][] = ["customer", "persona", "team"];

/* ── Derived figures ──────────────────────────────────────────────────────── */

/** The work summary: how many items sit in each board CATEGORY, plus how many are past due.
 *
 *  Counted by category rather than by status, because the categories are the closed vocabulary
 *  every project shares — a project that renamed "In progress" to "Cooking" still reports its
 *  cooking cards as in flight, and a summary written against status LABELS would report nothing
 *  for it. An item whose statusId resolves to no status (a stale id) is counted in `unknown`
 *  rather than silently dropped, so the parts always sum to the whole.
 *
 *  OVERDUE is "has a due date strictly before today, and is not finished": `done` and `canceled`
 *  are both terminal, and a closed card with a past due date is history, not a problem. Today is
 *  the viewer's LOCAL day (see helpers.todayIndex), so the count changes when their date does. */
function workSummary(items: WorkItem[], statuses: ProjectStatus[]) {
  const category = new Map(statuses.map((s) => [s.id, s.category]));
  const counts = { backlog: 0, todo: 0, in_progress: 0, done: 0, canceled: 0, unknown: 0 };
  const today = todayIndex();
  let overdue = 0;
  for (const item of items) {
    const cat = category.get(item.statusId);
    if (cat) counts[cat] += 1;
    else counts.unknown += 1;
    if (cat === "done" || cat === "canceled") continue;
    const due = item.dueDate ? dayIndex(item.dueDate) : null;
    if (due !== null && due < today) overdue += 1;
  }
  const open = items.length - counts.done - counts.canceled;
  return { ...counts, open, total: items.length, overdue };
}

/** The material summary: how many links point each way, and how many of them no longer resolve.
 *
 *  `unresolved` is counted because it is the one number here that is a PROBLEM rather than a
 *  size: a link whose target was deleted still lists (Contents says so on the row), and a project
 *  quietly accumulating dead pointers is worth seeing from the front door. */
function materialSummary(artifacts: ProjectArtifact[]) {
  let ingested = 0;
  let produced = 0;
  let unresolved = 0;
  for (const a of artifacts) {
    if (a.direction === "produced") produced += 1;
    else ingested += 1;
    if (!a.target) unresolved += 1;
  }
  return { ingested, produced, unresolved, total: artifacts.length };
}

/* ── Pane ─────────────────────────────────────────────────────────────────── */

export function ProjectOverviewPane({
  projectId,
  title,
  renderTransferOwnership,
}: {
  projectId: string;
  title: string;
  /**
   * Host-injected Transfer Ownership section, rendered last in the pane. Absent on a standalone
   * feature site (`frontend/src/marketing/projects` mounts `ProjectsFeature` without it) — the
   * host owns the workspace list and the mutation.
   *
   * Handed the LOADED project rather than the editable draft below: `name` is a separate piece of
   * state that only re-syncs from a project row on load and after a save adopts the returned one,
   * so a typed-but-unsaved rename would otherwise reach the confirmation dialog as the object's
   * name while the server still knows it by the old one.
   */
  renderTransferOwnership?: (project: { id: string; name: string }) => ReactNode;
}): ReactElement {
  // The host-injected per-record affordance (the hub's api-explorer button); null on
  // a standalone feature site → the trailing slot renders nothing.
  const renderRecordAffordance = useRecordAffordance();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable settings draft (populated from the loaded project; re-synced when the
  // project changes — on load and after a successful save adopts the returned row).
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [color, setColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The participant add control (the roster itself is a shared resource list, below).
  const [kindDraft, setKindDraft] =
    useState<ProjectParticipant["participantKind"]>("customer");
  const [idDraft, setIdDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // A failed REMOVE. Separate from the hook's load error (which is about reading the roster) and
  // from `addError` (which belongs under the add control, not by the list).
  const [removeError, setRemoveError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* ── The lists this pane summarises ────────────────────────────────────────
   * The SAME cache keys the topics that own these lists use, so the two directions of a
   * navigation both paint from cache: Overview → Work Items is instant, and so is the way back.
   * Each summary read fails SOFT to an empty list — a project's front door should still tell you
   * what it is when one of four background reads is unavailable, and each panel's own zero state
   * is a truthful reading of "nothing came back". The project record itself is the exception: it
   * IS the pane, so its absence is the "not found" state. */
  const loadItems = useCallback(
    () => projectWorkItemsApi.listForProject(projectId).catch(() => [] as WorkItem[]),
    [projectId],
  );
  const loadStatuses = useCallback(
    () => projectsApi.statuses.list(projectId).catch(() => [] as ProjectStatus[]),
    [projectId],
  );
  const loadParticipants = useCallback(
    () => projectsApi.participants.list(projectId),
    [projectId],
  );
  const loadArtifacts = useCallback(
    () => projectArtifactsApi.list(projectId).catch(() => [] as ProjectArtifact[]),
    [projectId],
  );
  // Newest-first, and only the head of the trail: the Activity topic owns the paginated read.
  const loadActivity = useCallback(
    () =>
      projectActivityApi
        .projectActivity(projectId, { limit: RECENT_ACTIVITY })
        .then((page) => page.rows)
        .catch(() => [] as ProjectActivity[]),
    [projectId],
  );

  const { items: itemRows } = useResourceList<WorkItem>(
    `project:${projectId}:work-items`,
    loadItems,
  );
  const { items: statusRows } = useResourceList<ProjectStatus>(
    `project:${projectId}:statuses`,
    loadStatuses,
  );
  // The roster is the one list this pane WRITES, so it keeps its error and its reload.
  const {
    items: participantRows,
    reload: reloadParticipants,
    error: participantsError,
  } = useResourceList<ProjectParticipant>(
    `project:${projectId}:participants`,
    loadParticipants,
  );
  const { items: artifactRows } = useResourceList<ProjectArtifact>(
    `project:${projectId}:artifacts`,
    loadArtifacts,
  );
  const { items: activityRows } = useResourceList<ProjectActivity>(
    `project:${projectId}:recent-activity`,
    loadActivity,
  );

  const participants = participantRows;
  const work = useMemo(
    () => workSummary(itemRows ?? [], statusRows ?? []),
    [itemRows, statusRows],
  );
  const material = useMemo(() => materialSummary(artifactRows ?? []), [artifactRows]);

  // Seed the editable draft from a project row — called when the load resolves and
  // after a save adopts the returned row (so a save clears the dirty state). Kept
  // imperative (seeded exactly when data arrives) rather than a derive-from-state
  // effect. Setters are stable, so this callback is stable.
  const seedDraft = useCallback((p: Project) => {
    setName(p.name);
    setDescription(p.description ?? "");
    setStatus(p.status);
    setColor(p.color);
  }, []);

  // Load the project. ResourceExplorer keys the topic pane by the project id, so a
  // project switch remounts this with fresh state (loading starts true) — no reset
  // dance needed; an `alive` flag just drops a response that resolves after unmount.
  useEffect(() => {
    let alive = true;
    void projectsApi.get(projectId).then((p) => {
      if (!alive) return;
      setProject(p);
      if (p) seedDraft(p);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, seedDraft]);

  // Only PATCH the fields that actually changed (project routes patch, not put).
  const patch = useMemo(() => {
    if (!project) return {};
    const next: {
      name?: string;
      description?: string;
      status?: string;
      color?: string;
    } = {};
    if (name.trim() !== project.name) next.name = name.trim();
    if (description !== (project.description ?? "")) next.description = description;
    if (status !== project.status) next.status = status;
    if (color.trim() !== project.color) next.color = color.trim();
    return next;
  }, [project, name, description, status, color]);

  const dirty = Object.keys(patch).length > 0;
  const canSave = dirty && name.trim().length > 0 && !saving;

  async function save() {
    if (!project || !dirty) return;
    if (!name.trim()) {
      setSaveError("Name is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await projectsApi.update(projectId, patch);
      if (mounted.current) {
        setProject(updated);
        seedDraft(updated);
      }
    } catch (e) {
      if (mounted.current) {
        setSaveError(
          isConflict(e)
            ? "That change conflicts with an existing value."
            : e instanceof Error
              ? e.message
              : "Failed to save changes.",
        );
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  async function addParticipant() {
    // The Add button is disabled while adding, but the Enter-key path is not —
    // guard here so a rapid double-Enter can't fire a second add.
    if (adding) return;
    const participantId = idDraft.trim();
    if (!participantId) {
      setAddError("Enter a participant id.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await projectsApi.participants.add(projectId, {
        participantKind: kindDraft,
        participantId,
      });
    } catch (e) {
      if (mounted.current) {
        setAddError(
          isConflict(e)
            ? `That ${kindDraft} is already a participant.`
            : e instanceof Error
              ? e.message
              : "Failed to add participant.",
        );
      }
      return;
    } finally {
      if (mounted.current) setAdding(false);
    }
    if (mounted.current) setIdDraft("");
    // The reload's own promise rejects on failure; the hook has already surfaced it as
    // `participantsError`, so there is nothing left for this caller to do with it.
    await reloadParticipants().catch(() => {});
  }

  async function removeParticipant(p: ProjectParticipant) {
    // Guard against a rapid double-click firing two DELETEs for the same row (mirrors
    // addParticipant's `adding` guard).
    if (removingId === p.id) return;
    setRemovingId(p.id);
    setRemoveError(null);
    try {
      await projectsApi.participants.remove(projectId, p.participantId, p.participantKind);
    } catch (e) {
      if (mounted.current) {
        setRemoveError(e instanceof Error ? e.message : "Failed to remove participant.");
      }
      return;
    } finally {
      if (mounted.current) setRemovingId(null);
    }
    await reloadParticipants().catch(() => {});
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <FeatureTitle
        title={title}
        trailing={renderRecordAffordance?.({
          path: "/project/projects/{id}",
          pathValues: { id: projectId },
          title: "Project API",
        })}
      />
      <section className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
        {loading ? (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        ) : !project ? (
          <EmptyState title="Project not found." />
        ) : (
          <>
            {/* ── What this project is ─────────────────────────────────── */}
            <header className="flex max-w-3xl flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{project.status}</Badge>
                {project.archivedAt && <Badge variant="orange">archived</Badge>}
              </div>
              {project.description ? (
                <p className="text-sm whitespace-pre-wrap text-apt-text-muted">
                  {project.description}
                </p>
              ) : (
                // An absent description is a fact about the project, not an error — say so
                // plainly and point at where it is written, rather than rendering a gap.
                <p className="text-sm text-apt-text-dim italic">
                  No description yet — add one in Project settings below.
                </p>
              )}
            </header>

            {/* ── How it is doing ──────────────────────────────────────── */}
            <div className="grid gap-4 lg:grid-cols-3">
              <StatCard
                title="Work"
                icon={<ListTodo size={15} className="text-apt-text-muted" aria-hidden />}
                stats={[
                  { label: "Open", value: work.open },
                  {
                    label: "In progress",
                    value: work.in_progress,
                    tone: categoryVariant("in_progress"),
                  },
                  { label: "Done", value: work.done, tone: categoryVariant("done") },
                  // Only when there ARE any: a permanent "Overdue 0" trains the eye to skip the
                  // row, which is the one row that must never be skipped.
                  ...(work.overdue > 0
                    ? [{ label: "Overdue", value: work.overdue, tone: "error" as const }]
                    : []),
                ]}
                footnote={
                  work.total === 0
                    ? "no work items yet"
                    : `${work.total} item${work.total === 1 ? "" : "s"} · ${Math.round(
                        (work.done / work.total) * 100,
                      )}% done`
                }
              />

              <StatCard
                title="Material"
                icon={<FileStack size={15} className="text-apt-text-muted" aria-hidden />}
                stats={[
                  { label: "Ingested", value: material.ingested },
                  { label: "Produced", value: material.produced },
                  ...(material.unresolved > 0
                    ? [
                        {
                          label: "Unresolved",
                          value: material.unresolved,
                          tone: "orange" as const,
                        },
                      ]
                    : []),
                ]}
                footnote={
                  material.total === 0
                    ? "nothing attached yet"
                    : `${material.total} attachment${material.total === 1 ? "" : "s"}`
                }
              />

              <InfoPanel
                title="Recent activity"
                icon={<Activity size={15} className="text-apt-text-muted" aria-hidden />}
              >
                {activityRows === null ? (
                  <p className="text-sm text-apt-text-muted">Loading…</p>
                ) : activityRows.length === 0 ? (
                  <p className="text-sm text-apt-text-dim">Nothing has happened yet.</p>
                ) : (
                  <StatList as="ul">
                    {activityRows.map((row) => (
                      <StatListRow
                        key={row.id}
                        as="li"
                        // A comment's own words say more than "commented" does, so when there
                        // is a body it IS the line — same precedence the full feed uses.
                        label={`${actorText(row)} ${
                          commentBody(row) ?? actionPhrase(row.action)
                        }`}
                        labelTitle={`${actorText(row)} ${actionPhrase(row.action)}`}
                        trailing={
                          <time dateTime={row.createdAt} className="text-apt-text-dim">
                            {relativeTime(row.createdAt)}
                          </time>
                        }
                      />
                    ))}
                  </StatList>
                )}
              </InfoPanel>
            </div>

            {/* ── Who is in it ─────────────────────────────────────────── */}
            <InfoPanel
              title="People"
              icon={<Users size={15} className="text-apt-text-muted" aria-hidden />}
              count={participants?.length ?? 0}
              className="max-w-3xl"
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Kind" className="w-40">
                    <Select
                      value={kindDraft}
                      onChange={(e) => {
                        setAddError(null);
                        setKindDraft(
                          e.target.value as ProjectParticipant["participantKind"],
                        );
                      }}
                    >
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Participant id" className="min-w-56 flex-1">
                    <Input
                      value={idDraft}
                      onChange={(e) => {
                        setAddError(null);
                        setIdDraft(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void addParticipant();
                      }}
                      placeholder="Actor id"
                    />
                  </Field>
                  <Button
                    onClick={() => void addParticipant()}
                    disabled={adding || !idDraft.trim()}
                  >
                    Add
                  </Button>
                </div>
                <ErrorText error={addError} />

                {/* A read failure and a failed remove are different events, and they do not
                    co-occur in practice — one line, whichever happened. */}
                <ErrorText error={participantsError ?? removeError} />
                {participants === null ? (
                  // Only while the read is genuinely outstanding: with an error above, "Loading…"
                  // is a promise the pane is not keeping.
                  participantsError ? null : (
                    <p className="text-sm text-apt-text-muted">Loading…</p>
                  )
                ) : participants.length === 0 ? (
                  <EmptyState title="No participants yet." />
                ) : (
                  <List>
                    {participants.map((p) => (
                      <ListItem key={p.id} className="justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge variant={kindVariant(p.participantKind)}>
                            {p.participantKind}
                          </Badge>
                          <span className="truncate font-mono text-sm text-apt-text">
                            {p.participantId}
                          </span>
                          {p.role && p.role !== "member" && (
                            <span className="shrink-0 text-xs text-apt-text-muted">
                              {p.role}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${p.participantId}`}
                          disabled={removingId === p.id}
                          onClick={() => void removeParticipant(p)}
                        >
                          <Trash2 />
                        </Button>
                      </ListItem>
                    ))}
                  </List>
                )}
              </div>
            </InfoPanel>

            {/* ── Its own record ───────────────────────────────────────── */}
            <Disclosure
              title="Project settings"
              subtitle="Name, description, lifecycle status, and board accent."
              className="max-w-3xl"
            >
              <div className="flex max-w-xl flex-col gap-5">
                <Field label="Name">
                  <Input
                    value={name}
                    onChange={(e) => {
                      setSaveError(null);
                      setName(e.target.value);
                    }}
                    placeholder="Website relaunch"
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    value={description}
                    onChange={(e) => {
                      setSaveError(null);
                      setDescription(e.target.value);
                    }}
                    placeholder="What is this project about? (optional)"
                    rows={3}
                  />
                </Field>
                <Field label="Status">
                  <Input
                    value={status}
                    onChange={(e) => {
                      setSaveError(null);
                      setStatus(e.target.value);
                    }}
                    placeholder="active"
                  />
                </Field>
                <Field label="Color" hint="The project's board accent.">
                  <Input
                    value={color}
                    onChange={(e) => {
                      setSaveError(null);
                      setColor(e.target.value);
                    }}
                    placeholder="Board accent color"
                  />
                </Field>
                <ErrorText error={saveError} />
                <div className="flex items-center gap-2">
                  <Button onClick={() => void save()} disabled={!canSave}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </Disclosure>

            {/* ── Transfer ─────────────────────────────────────────────── */}
            {renderTransferOwnership && renderTransferOwnership(project)}
          </>
        )}
      </section>
    </div>
  );
}
