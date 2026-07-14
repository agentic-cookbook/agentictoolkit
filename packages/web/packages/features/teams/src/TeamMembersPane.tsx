"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Bot, Trash2, UserRound } from "lucide-react";

import { teamMembersApi, type TeamMember } from "@agentic-toolkit/data/teams";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { api as personaApi, type Persona } from "@agentic-toolkit/data/personas";
import type { TopicDetailItem, TopicLevel } from "@agentic-toolkit/ui/blocks";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Button } from "@agentic-toolkit/ui/components/button";
import {
  useStackLevel,
  useRailExitGuard as useWorkspaceExitGuard,
  useRecordAffordance,
  type TopicLeaf,
} from "@agentic-toolkit/resource";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Members feature for the ACTIVE team — wired to the backend (api/team-members.ts). A member is
 * either an existing customer (added by email, resolved server-side) or one of the caller's
 * personas (added by key; the backend gates on the persona's may_act 'team' grant). Rows render
 * by kind: a customer shows its email + a person icon, a persona shows its name/slug + a Bot icon.
 *
 * In the one-stack model the members list is a PUBLISHED level (selecting a member deep-links it),
 * and the leaf detail is either the member's card (with a Delete button) or — while creating — the
 * add form (an add-by-email field plus an add-a-persona picker). Membership is add/remove, so there
 * is no per-member rename/editor.
 */
export function TeamMembersPane({
  teamId,
  leaf,
}: {
  teamId?: string;
  /** Unused: the breadcrumb names the pane now (kept for the topic render prop shape). */
  title?: ReactNode;
  /** Deep-linkable member selection (`…/members/<memberId>`). */
  leaf?: TopicLeaf;
}) {
  // The host-injected per-record affordance (the hub's api-explorer button); null on
  // a standalone feature site → the trailing slot renders nothing.
  const renderRecordAffordance = useRecordAffordance();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The caller's own personas, for the add-persona picker. The backend enforces which of them
  // may act for a team (403 on add if not granted), so we list them all rather than pre-filtering.
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [personaDraft, setPersonaDraft] = useState("");
  const [addingPersona, setAddingPersona] = useState(false);
  // In-flight guard for the email add — mirrors `addingPersona` for the persona add so a
  // double-submit (a second click, or an Enter while the POST is still in flight) can't
  // fire a second `teamMembersApi.add`.
  const [savingMember, setSavingMember] = useState(false);
  // In-flight guard for the member delete — mirrors `savingMember` so a rapid double-click
  // can't fire two DELETEs for the selected member.
  const [removingMember, setRemovingMember] = useState(false);

  // A monotonic request seq + a mounted flag guard the async list fetch: a stale in-flight response
  // (from a previous team, or one that resolves after unmount) can never overwrite the current team.
  const reqSeq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (showLoading: boolean) => {
      if (!teamId) {
        setMembers([]);
        return;
      }
      const seq = ++reqSeq.current;
      if (showLoading) {
        setMembers(null);
        setError(null);
      }
      setLoadError(null);
      try {
        const rows = await teamMembersApi.list(teamId);
        if (mounted.current && seq === reqSeq.current) setMembers(rows);
      } catch (e) {
        if (mounted.current && seq === reqSeq.current) {
          setMembers([]);
          setLoadError(e instanceof Error ? e.message : "Failed to load members.");
        }
      }
    },
    [teamId],
  );

  // Load on mount and whenever the active team changes (load(true) handles the reset).
  useEffect(() => {
    void load(true);
  }, [load]);

  // Load the caller's personas once for the add-persona picker (caller-scoped, not team-scoped).
  useEffect(() => {
    let live = true;
    personaApi.personas
      .list()
      .then((res) => {
        if (live) setPersonas(res);
      })
      .catch((e) => {
        if (live) setPersonasError(e instanceof Error ? e.message : "Failed to load personas.");
      });
    return () => {
      live = false;
    };
  }, []);

  const selectedId = leaf?.leafId ?? null;
  const selected = selectedId
    ? (members ?? []).find((m) => m.id === selectedId) ?? null
    : null;

  // Discriminate on memberKind (robust even while the api-types field is optional): a persona
  // member shows its persona name/slug + a Bot icon; everything else is a customer, labelled by
  // email → display name → raw id (the last for a member outside the caller's ecosystem).
  const isPersona = (m: TeamMember) => m.memberKind === "persona";
  const labelFor = (m: TeamMember) =>
    isPersona(m)
      ? m.personaName ?? m.personaSlug ?? m.userId
      : m.email ?? m.displayName ?? m.userId;
  const iconFor = (m: TeamMember) =>
    isPersona(m) ? <Bot size={16} aria-hidden /> : <UserRound size={16} aria-hidden />;

  const value = draft.trim().toLowerCase();
  const canSave = creating && EMAIL_RE.test(value) && !savingMember;

  const startCreate = () => {
    setError(null);
    setDraft("");
    setPersonaDraft("");
    setCreating(true);
    // Clear any selected member from the URL so the create form is the only leaf.
    if (selectedId) leaf?.onSelect(null);
  };

  // Add the drafted member. Returns true on success so the exit guard can proceed.
  const save = useCallback(async (): Promise<boolean> => {
    if (!teamId || !creating) return true;
    // Already mid-add (a double-submit — a second click or an Enter during the POST):
    // ignore it so only one `add` fires. Covers the button AND the editorKeyDown Enter.
    if (savingMember) return false;
    setError(null);
    if (!EMAIL_RE.test(draft.trim().toLowerCase())) {
      setError("Enter a valid email address.");
      return false;
    }
    setSavingMember(true);
    try {
      await teamMembersApi.add(teamId, draft.trim().toLowerCase());
    } catch (e) {
      // Surface the backend's message (e.g. "no user with email …", "already a member").
      setError(e instanceof Error ? e.message : "Failed to add member.");
      return false;
    } finally {
      setSavingMember(false);
    }
    setCreating(false);
    setDraft("");
    await load(false);
    return true;
  }, [teamId, creating, savingMember, draft, load]);

  // Add the picked persona as a team member. Mirrors the email add: await the backend (which
  // gates on may_act 'team' — 403 if the persona lacks it, 404 if unknown), surface the thrown
  // message inline on failure, otherwise reset the picker and reload the roster. Returns true on
  // success so the exit guard can proceed (mirrors `save`).
  const addPersonaMember = useCallback(async (): Promise<boolean> => {
    if (!teamId || !personaDraft) return false;
    setError(null);
    setAddingPersona(true);
    try {
      await teamMembersApi.addPersona(teamId, personaDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add persona.");
      setAddingPersona(false);
      return false;
    }
    setAddingPersona(false);
    setPersonaDraft("");
    setCreating(false);
    await load(false);
    return true;
  }, [teamId, personaDraft, load]);

  // Route the exit-guard's save to the matching create action: a picked persona → add the
  // persona; otherwise → add the email draft. Both return a success boolean the guard proceeds on.
  const saveDraft = useCallback((): Promise<boolean> => {
    if (personaDraft !== "") return addPersonaMember();
    return save();
  }, [personaDraft, addPersonaMember, save]);

  const cancelCreate = () => {
    setError(null);
    setCreating(false);
    setDraft("");
    setPersonaDraft("");
  };

  async function del() {
    if (!teamId || !selected) return;
    if (removingMember) return;
    setRemovingMember(true);
    try {
      await teamMembersApi.remove(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member.");
      return;
    } finally {
      setRemovingMember(false);
    }
    leaf?.onSelect(null);
    await load(false);
  }

  // PUBLISH the members as a stack level. The New member affordance is the header `+`.
  const rows: TopicDetailItem[] = (members ?? []).map((m) => ({
    id: m.id,
    label: labelFor(m),
    sublabel: isPersona(m) ? m.personaSlug ?? undefined : undefined,
    icon: iconFor(m),
  }));
  const level: TopicLevel = {
    id: "members-list",
    title: "Members",
    items: rows,
    selectedId: creating ? null : selectedId,
    onSelect: (id) => leaf?.onSelect(id),
    onClear: () => leaf?.onSelect(null),
    emptyLabel: members === null ? "Loading…" : "No members yet.",
    // "New member" is a right-justified `+` in the list header; gold while creating.
    onNew: startCreate,
    newLabel: "New member",
    newActive: creating,
    // While the add-member form is open the pane body IS the detail — without this
    // the automatic TopicOverview (unselected frontier) covers the open form.
    overview: creating ? false : undefined,
  };
  useStackLevel(level);
  // The create form is the only "dirty" state here (members have no editor) — guard it when
  // EITHER the email draft or the persona picker holds a value, so a picked-but-unsaved persona
  // is no longer silently discarded on exit. save routes to the matching action (saveDraft).
  useWorkspaceExitGuard(
    creating && (draft.trim() !== "" || personaDraft !== "")
      ? { isDirty: () => true, save: saveDraft }
      : null,
  );

  function editorKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void save();
    if (e.key === "Escape") cancelCreate();
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <section className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-8">
        {teamId && (
          <div className="flex justify-end">
            {renderRecordAffordance?.({
              path: "/team/members",
              pathValues: {},
              queryValues: { teamId },
              title: "Team members API",
            })}
          </div>
        )}
        <ErrorText error={error} />
        <ErrorText error={loadError} />
        {creating ? (
          // The create leaf: add an existing customer by email, OR one of the caller's personas.
          <div className="flex max-w-md flex-col gap-6">
            <div className="flex flex-col gap-3">
              <label htmlFor="tm-new-member-email" className="font-mono text-sm text-apt-gold">
                New member
              </label>
              <Input
                id="tm-new-member-email"
                /* eslint-disable-next-line jsx-a11y/no-autofocus -- intentional focus-on-open for the new-member field */
                autoFocus
                value={draft}
                onChange={(e) => {
                  setError(null);
                  setDraft(e.target.value);
                }}
                onKeyDown={editorKeyDown}
                placeholder="name@example.com"
                type="email"
              />
              <p className="text-xs text-apt-text-dim">
                Add an existing customer by email — the backend resolves them to their account.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={cancelCreate}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={!canSave}>
                  Add member
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-apt-border pt-6">
              {personas === null ? (
                <p className="text-sm text-apt-text-muted">Loading personas…</p>
              ) : personasError ? (
                <ErrorText error={personasError} />
              ) : personas.length === 0 ? (
                <p className="text-sm text-apt-text-muted">You have no personas to add.</p>
              ) : (
                <>
                  <Field label="Add a persona">
                    <Select
                      value={personaDraft}
                      onChange={(e) => {
                        setError(null);
                        setPersonaDraft(e.target.value);
                      }}
                    >
                      <option value="">Choose a persona…</option>
                      {personas.map((persona) => (
                        <option key={persona.id} value={persona.id}>
                          {persona.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className="text-xs text-apt-text-dim">
                    Add one of your personas. It must be allowed to act for a team, or the add is
                    rejected.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => void addPersonaMember()}
                    disabled={!personaDraft || addingPersona}
                  >
                    Add persona
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : selected ? (
          // The member-detail leaf: the member's identity + a Delete action (no rename).
          <div className="flex max-w-md flex-col gap-4">
            <div className="flex items-center gap-3">
              {isPersona(selected) ? (
                <Bot size={20} aria-hidden className="text-apt-text-muted" />
              ) : (
                <UserRound size={20} aria-hidden className="text-apt-text-muted" />
              )}
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-sm text-apt-text">
                  {labelFor(selected)}
                </span>
                {isPersona(selected) && (
                  <span className="font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
                    Persona{selected.personaSlug ? ` · ${selected.personaSlug}` : ""}
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive-ghost"
              onClick={() => void del()}
              disabled={removingMember}
              className="self-start"
            >
              <Trash2 data-icon="inline-start" />
              Remove from team
            </Button>
          </div>
        ) : members === null ? (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        ) : (
          <EmptyState
            title="Select a member, or add one."
            description="Use “New member” to add a customer by email or one of your personas."
          />
        )}
      </section>
    </div>
  );
}
