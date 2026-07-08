"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { Select } from "@agentic-toolkit/ui/components/select";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { Button } from "@agentic-toolkit/ui/components/button";
import { isConflict } from "@agentic-toolkit/data";
import {
  projectsApi,
  type Project,
  type ProjectParticipant,
} from "@agentic-toolkit/data/projects";
import { FeatureTitle, useRecordAffordance } from "@agentic-toolkit/resource";
import { type BadgeVariant } from "./helpers";

/**
 * The full Overview pane for the active project (T3): editable project settings
 * (name / description / status / color) saved via `projectsApi.update`, plus the
 * participants list with an add control and a per-row remove. Replaces T2's
 * minimal name+status Overview.
 *
 * It renders its content inline (like the T2 Overview did) rather than publishing
 * a stack level, so it slots straight into the ResourceExplorer Overview topic pane and
 * a plain render exercises it in tests. The settings edit follows the Team
 * settings idiom — an explicit Save that PATCHes only the changed fields, then
 * adopts the returned row — while participants follow the Team members idiom
 * (reload-after-write for add/remove). A duplicate add answers 409; `isConflict`
 * turns that into a friendly inline message rather than a raw thrown error.
 *
 * Note: the project's own `status` is a FREE-FORM lifecycle varchar (e.g.
 * "active") with no backend enum guard — a different axis from the per-project
 * work-item board columns (`statuses.list`). So it edits as a free-text Input,
 * not a Select over the board columns (which would mislabel the project with a
 * column key like "todo").
 */

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

/* ── Pane ─────────────────────────────────────────────────────────────────── */

export function ProjectOverviewPane({
  projectId,
  title,
}: {
  projectId: string;
  title: string;
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

  // Participants + add control.
  const [participants, setParticipants] = useState<ProjectParticipant[] | null>(null);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [kindDraft, setKindDraft] =
    useState<ProjectParticipant["participantKind"]>("customer");
  const [idDraft, setIdDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // A monotonic request seq guards loadParticipants: overlapping reloads (fired back-to-back
  // by addParticipant/removeParticipant) can resolve out of order, so only the LATEST
  // request's response is ever applied to state — a stale response can never clobber a newer
  // one. Paired with the mounted flag below (a response resolving after unmount is dropped too).
  const reqSeq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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

  const loadParticipants = useCallback(async () => {
    const seq = ++reqSeq.current;
    setParticipantsError(null);
    try {
      const rows = await projectsApi.participants.list(projectId);
      if (mounted.current && seq === reqSeq.current) setParticipants(rows);
    } catch (e) {
      if (mounted.current && seq === reqSeq.current) {
        setParticipants([]);
        setParticipantsError(
          e instanceof Error ? e.message : "Failed to load participants.",
        );
      }
    }
  }, [projectId]);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

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
    await loadParticipants();
  }

  async function removeParticipant(p: ProjectParticipant) {
    // Guard against a rapid double-click firing two DELETEs for the same row (mirrors
    // addParticipant's `adding` guard).
    if (removingId === p.id) return;
    setRemovingId(p.id);
    setParticipantsError(null);
    try {
      await projectsApi.participants.remove(projectId, p.participantId, p.participantKind);
    } catch (e) {
      if (mounted.current) {
        setParticipantsError(
          e instanceof Error ? e.message : "Failed to remove participant.",
        );
      }
      return;
    } finally {
      if (mounted.current) setRemovingId(null);
    }
    await loadParticipants();
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
      <section className="flex min-w-0 flex-1 flex-col gap-8 overflow-y-auto px-6 py-4">
        {loading ? (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        ) : !project ? (
          <EmptyState title="Project not found." />
        ) : (
          <>
            {/* ── Settings ─────────────────────────────────────────────── */}
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
              {saveError && <p className="text-sm text-apt-red">{saveError}</p>}
              <div className="flex items-center gap-2">
                <Button onClick={() => void save()} disabled={!canSave}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>

            {/* ── Participants ─────────────────────────────────────────── */}
            <div className="flex max-w-xl flex-col gap-3">
              <h3 className="text-sm font-semibold text-apt-text">Participants</h3>

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
              {addError && <p className="text-sm text-apt-red">{addError}</p>}

              {participantsError && (
                <p className="text-sm text-apt-red">{participantsError}</p>
              )}
              {participants === null ? (
                <p className="text-sm text-apt-text-muted">Loading…</p>
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
          </>
        )}
      </section>
    </div>
  );
}
