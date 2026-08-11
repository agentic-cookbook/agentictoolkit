"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Bot, Trash2, UserRound, UsersRound } from "lucide-react";

import { useResourceItemQuery, useResourceList } from "@agentic-toolkit/data";
import {
  accessApi,
  type AccessAssignmentRow,
  type AccessRoleRow,
  type EffectiveAccessRow,
} from "@agentic-toolkit/data/access";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Button } from "@agentic-toolkit/ui/components/button";
import { FeatureTitle } from "@agentic-toolkit/resource";

/** A share target the host resolves from its member registry — a customer, a
 *  persona, or a whole team. Same host-owned seam as AccessPane's usersDirectory:
 *  the feature only needs an id + a label to populate the picker and the row list. */
export interface AccessSubject {
  kind: "customer" | "persona" | "team";
  id: string;
  label: string;
}

export interface ItemAccessPanelProps {
  workspaceSlug: string;
  /** The feature area the item lives in — 'projects' | 'personas'. */
  feature: string;
  itemId: string;
  /** The item's name, for the heading (falls back to a bare "Access"). */
  itemLabel?: string;
  /** FeatureTitle slot, like the sibling panes. */
  title?: ReactNode;
  /** Host-injected subject directory for the "share with…" picker — the member
   *  registry stays host-owned (same seam as AccessPane's usersDirectory). */
  subjectsDirectory: (workspaceSlug: string) => Promise<AccessSubject[]>;
}

const ITEM_VERBS = ["C", "R", "U", "D", "M"] as const;

/** A verb-string ('C,R,U') → its letters. Empty/whitespace tolerated. */
function splitVerbs(s: string): string[] {
  return s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** A 403/404 on the M-gated reads means "no access management here" — a defined
 *  quiet state, never an error (the client can't distinguish forbidden from a
 *  visibility 404, and neither should surface as a failure). */
function isNoAccess(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status;
  return status === 403 || status === 404;
}

/** One read's worth of the M-gated assignment list. The three fields arrive from ONE response and
 *  are cached as one value for that reason: split across three entries they could disagree, and a
 *  pane showing "Restricted" beside the inherited assignment list is a lie about who can see the
 *  item. `noAccess` is in here rather than beside it because it is the same answer — the 403 that
 *  says this caller manages nothing here IS the read's result, not its failure. */
interface ItemAccessSnapshot {
  assignments: AccessAssignmentRow[];
  restricted: boolean;
  noAccess: boolean;
}

type Provenance = EffectiveAccessRow["decidedBy"][string];

/** One "because…" line for a verb, matching the doc's phrasing: owner/admin
 *  short-circuit to full access; grants read `via <role> (default role)` /
 *  `direct grant on this item (<role>)` / `via <role> (team grant)`. */
function describeProvenance(p: Provenance | undefined): string {
  if (!p) return "no grant";
  if (p.kind === "owner") return "Workspace owner — full access";
  if (p.kind === "admin-role") return "Workspace admin — full access";
  const role = p.roleSlug ?? "role";
  if (p.via === "default") return `via ${role} (default role)`;
  if (p.via === "team") return `via ${role} (team grant)`;
  const where = p.scopeItemId ? " on this item" : "";
  return `direct grant${where} (${role})`;
}

/**
 * The per-item SHARE PANEL (docs/workspace-roles-permissions.md §UI) — the
 * Drive/Notion-style access panel mounted on ONE top-level item (a project or a
 * persona) as an HTD "Access" topic. Top to bottom: the Inherited⇄Restricted mode
 * row (restrict/restore), the item's assignment list (per-row role select + remove),
 * a subject picker to share with someone new, and a per-subject effective-permission
 * explainer. Renders inline (publishes no stack level), like the sibling ProjectActivityPane.
 *
 * The whole surface is M-gated: listAssignments answers 403/404 to a caller without
 * Manage-access on the item, which resolves to a quiet "you don't manage access" state
 * rather than an error (no existence leak).
 */
export function ItemAccessPanel({
  workspaceSlug,
  feature,
  itemId,
  itemLabel,
  title,
  subjectsDirectory,
}: ItemAccessPanelProps) {
  const [error, setError] = useState<string | null>(null);

  // The add-row draft (subject key `<kind>:<id>` + role) and a busy guard so a
  // double-click can't fire a second mutation while one is in flight.
  const [addSubjectKey, setAddSubjectKey] = useState("");
  const [addRoleId, setAddRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // The open explainer, as a subject key (`<kind>:<id>`) — also the cache id its verbs are read
  // under, so re-opening a row someone already expanded costs no read at all.
  const [explainKey, setExplainKey] = useState<string | null>(null);

  // The assignment list, cached per (workspace, feature, item). Re-opening Access on an item you
  // have already looked at paints its rows on the first frame and re-reads behind that paint. The
  // whole scope is in the key, so switching items reads a DIFFERENT entry rather than racing one
  // item's response into another item's pane — which is what the hand-rolled generation counters
  // existed to prevent.
  //
  // The M-gate is resolved INSIDE the fetcher: a 403/404 is this surface's quiet "you don't manage
  // access here", a defined answer worth caching, not a failure. Anything else rejects and reaches
  // the banner through the hook's own `error`.
  const loadSnapshot = useCallback(async (): Promise<ItemAccessSnapshot> => {
    try {
      const res = await accessApi.listAssignments(workspaceSlug, { feature, itemId });
      return { assignments: res.assignments, restricted: Boolean(res.restricted), noAccess: false };
    } catch (e) {
      if (isNoAccess(e)) return { assignments: [], restricted: false, noAccess: true };
      throw e;
    }
  }, [workspaceSlug, feature, itemId]);
  const {
    item: snapshot,
    error: loadError,
    reload: reloadSnapshot,
  } = useResourceItemQuery<ItemAccessSnapshot>(
    `workspace:${workspaceSlug}:item-access:${feature}`,
    itemId,
    loadSnapshot,
  );
  // Null rows until the first answer, exactly as before — but `restricted` and `noAccess` read
  // their SAFE side out of an absent snapshot: inherited, and managed. A pane that assumed
  // "restricted" or "no access" while its read was in flight would flash a claim about who can see
  // the item, and then contradict it a moment later.
  const assignments = snapshot?.assignments ?? null;
  const restricted = snapshot?.restricted ?? false;
  const noAccess = snapshot?.noAccess ?? false;

  // Both workspace-scoped and shared with every item's panel in that workspace: opening Access on a
  // second project reads neither of these again.
  //
  // Both fetchers SWALLOW and answer empty, which is the behaviour the hand-rolled loaders had and
  // is deliberate: neither list is a gate. A role select falls back to the raw role name, and an
  // empty directory only means the picker has no one to offer — the M-gated assignment list above
  // is the real gate. Swallowing inside the fetcher (rather than ignoring the hook's `error`) also
  // keeps a non-fatal miss out of the platform's auth telemetry.
  const loadRoles = useCallback(
    () => accessApi.listRoles(workspaceSlug).catch(() => [] as AccessRoleRow[]),
    [workspaceSlug],
  );
  const { items: roles } = useResourceList<AccessRoleRow>(
    `workspace:${workspaceSlug}:access-roles`,
    loadRoles,
  );

  const loadSubjects = useCallback(
    () => subjectsDirectory(workspaceSlug).catch(() => [] as AccessSubject[]),
    [workspaceSlug, subjectsDirectory],
  );
  const { items: subjects } = useResourceList<AccessSubject>(
    `workspace:${workspaceSlug}:access-subjects`,
    loadSubjects,
  );

  // The per-subject "why" explainer, read only while a row is expanded (`explainKey` null reads
  // nothing) and cached per subject, so collapsing and re-expanding a row is instant. The subject
  // is the cache ID and the item is in the key, so one row's answer can never be shown under
  // another's — the last thing the generation counter guarded.
  const loadEffective = useCallback(
    (key: string) => {
      // The key is `<kind>:<id>` and the id may itself contain colons, so split on the FIRST one
      // only. The kind is narrowed to the two the route accepts, which `onExplain` guarantees —
      // it refuses a team row outright, so no team key ever becomes an id here.
      const sep = key.indexOf(":");
      return accessApi.effective(workspaceSlug, {
        feature,
        subjectKind: key.slice(0, sep) as "customer" | "persona",
        subjectId: key.slice(sep + 1),
        itemId,
      });
    },
    [workspaceSlug, feature, itemId],
  );
  const { item: effective, error: effectiveError } = useResourceItemQuery<EffectiveAccessRow>(
    `workspace:${workspaceSlug}:effective-access:${feature}:${itemId}`,
    explainKey,
    loadEffective,
  );

  // Every mutation funnels through here: a single in-flight guard, a cleared error,
  // and — on success — a reload of the assignment list (the doc's "reload afterward").
  //
  // The re-read SWALLOWS, as the hand-rolled `refresh` did by construction: the mutation has
  // already succeeded by the time it runs, and reporting "Something went wrong." over a failed
  // re-read would name the wrong operation. The failure still shows — in `loadError` above.
  const runMutation = useCallback(
    async (fn: () => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        await fn();
        await reloadSnapshot().catch(() => {});
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [reloadSnapshot],
  );

  const keyOfAssignment = (a: AccessAssignmentRow) => `${a.subjectKind}:${a.subjectId}`;
  const keyOfSubject = (s: AccessSubject) => `${s.kind}:${s.id}`;

  const subjectLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subjects ?? []) m.set(keyOfSubject(s), s.label);
    return m;
  }, [subjects]);

  const assignedKeys = useMemo(
    () => new Set((assignments ?? []).map(keyOfAssignment)),
    [assignments],
  );
  const availableSubjects = useMemo(
    () => (subjects ?? []).filter((s) => !assignedKeys.has(keyOfSubject(s))),
    [subjects, assignedKeys],
  );

  const iconFor = (kind: AccessSubject["kind"]) =>
    kind === "persona" ? (
      <Bot size={16} aria-hidden className="shrink-0 text-apt-text-muted" />
    ) : kind === "team" ? (
      <UsersRound size={16} aria-hidden className="shrink-0 text-apt-text-muted" />
    ) : (
      <UserRound size={16} aria-hidden className="shrink-0 text-apt-text-muted" />
    );

  // Role <option>s for a row select, guaranteeing the current role is always present
  // (roles may still be loading, or a row may hold a role no longer in the list) so
  // the native select never renders a value with no matching option.
  const roleOptions = (currentId?: string, currentLabel?: string): ReactNode => {
    const opts = roles ?? [];
    const hasCurrent = !currentId || opts.some((r) => r.id === currentId);
    return (
      <>
        {!hasCurrent && currentId && <option value={currentId}>{currentLabel ?? currentId}</option>}
        {opts.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </>
    );
  };

  const onToggleMode = () =>
    void runMutation(() =>
      restricted
        ? accessApi.restoreItem(workspaceSlug, feature, itemId)
        : accessApi.restrictItem(workspaceSlug, feature, itemId),
    );

  const onChangeRole = (a: AccessAssignmentRow, roleId: string) =>
    void runMutation(async () => {
      await accessApi.putAssignment(workspaceSlug, {
        subjectKind: a.subjectKind,
        subjectId: a.subjectId,
        feature,
        itemId,
        roleId,
      });
    });

  const onRemove = (a: AccessAssignmentRow) =>
    void runMutation(() => accessApi.deleteAssignment(workspaceSlug, a.id));

  const onShare = () => {
    const subj = availableSubjects.find((s) => keyOfSubject(s) === addSubjectKey);
    if (!subj || !addRoleId) return;
    void runMutation(async () => {
      await accessApi.putAssignment(workspaceSlug, {
        subjectKind: subj.kind,
        subjectId: subj.id,
        feature,
        itemId,
        roleId: addRoleId,
      });
      // Reset the picker only on success (this runs before runMutation's catch).
      setAddSubjectKey("");
      setAddRoleId("");
    });
  };

  // Open (or toggle closed) the effective-permission explainer for a row. Teams have
  // no single effective set to explain, so they aren't explainable.
  //
  // Naming the row is the whole action now: the read hangs off `explainKey`, so opening one is a
  // single state change, and a row opened before re-opens from the cache with nothing in flight.
  const onExplain = (a: AccessAssignmentRow) => {
    if (a.subjectKind === "team") return;
    const key = keyOfAssignment(a);
    setExplainKey(explainKey === key ? null : key);
  };

  const heading = title ?? (itemLabel ? `Access · ${itemLabel}` : "Access");

  const renderExplainer = () => {
    if (effectiveError) return <ErrorText error={effectiveError} />;
    if (effective === null) return <p className="text-xs text-apt-text-muted">Loading…</p>;
    const have = splitVerbs(effective.itemVerbs);
    const subHave = splitVerbs(effective.subitemVerbs);
    const shortCircuit = Object.values(effective.decidedBy).find(
      (p) => p.kind === "owner" || p.kind === "admin-role",
    );
    return (
      <div className="mt-1 flex flex-col gap-2 rounded-md border border-apt-border bg-apt-surface/40 p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.65rem] uppercase tracking-wider text-apt-text-muted">
            Why
          </span>
          <div className="flex gap-1">
            {ITEM_VERBS.map((v) => {
              const on = have.includes(v);
              return (
                <span
                  key={v}
                  className={
                    "inline-flex h-5 w-5 items-center justify-center rounded border font-mono text-[0.65rem] " +
                    (on
                      ? "border-apt-gold text-apt-gold"
                      : "border-apt-border text-apt-text-dim opacity-50")
                  }
                >
                  {v}
                </span>
              );
            })}
          </div>
        </div>
        {shortCircuit ? (
          <p className="text-xs text-apt-text">{describeProvenance(shortCircuit)}</p>
        ) : have.length === 0 ? (
          <p className="text-xs text-apt-text-dim">No access to this item.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {have.map((v) => (
              <li key={v} className="text-xs text-apt-text-dim">
                <span className="font-mono text-apt-text">{v}</span>
                {" — "}
                {describeProvenance(effective.decidedBy[v])}
              </li>
            ))}
          </ul>
        )}
        {subHave.length > 0 && (
          <p className="text-xs text-apt-text-dim">
            Sub-items: <span className="font-mono text-apt-text">{subHave.join(" ")}</span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <FeatureTitle title={heading} />
      <section className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
        {noAccess ? (
          <EmptyState
            title="You don’t manage access for this item."
            description="Ask a workspace admin or the item’s owner if you need to change who can reach it."
          />
        ) : assignments === null ? (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        ) : (
          <>
            <ErrorText error={error} />
            <ErrorText error={loadError} />

            {/* Mode row — Inherited ⇄ Restricted (the Notion Restrict/Restore affordance). */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-apt-border p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-sm text-apt-text">
                  {restricted
                    ? "Restricted — only people listed here"
                    : "Access: Inherited from workspace"}
                </span>
                <span className="text-xs text-apt-text-dim">
                  {restricted
                    ? "Workspace-wide roles don’t apply. Only the people and teams below (plus workspace owners and admins) can reach it."
                    : "Everyone with a workspace role can reach this item. Restrict it to limit access to an explicit list."}
                </span>
              </div>
              <Button
                size="sm"
                variant={restricted ? "ghost" : "default"}
                onClick={onToggleMode}
                disabled={busy}
                className="shrink-0"
              >
                {restricted ? "Restore inherited" : "Restrict"}
              </Button>
            </div>

            {/* Assignment list — one row per subject: label, kind icon, role select, remove. */}
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-apt-text-muted">
                People with access
              </span>
              {assignments.length === 0 ? (
                <p className="text-sm text-apt-text-muted">No one is listed yet.</p>
              ) : (
                <List>
                  {assignments.map((a) => {
                    const label = subjectLabels.get(keyOfAssignment(a)) ?? a.subjectId;
                    const explainable = a.subjectKind !== "team";
                    const open = explainKey === keyOfAssignment(a);
                    return (
                      <ListItem key={a.id} className="flex-col items-stretch gap-2">
                        <div className="flex items-center gap-3">
                          {iconFor(a.subjectKind)}
                          {explainable ? (
                            <button
                              type="button"
                              onClick={() => onExplain(a)}
                              className="min-w-0 flex-1 truncate text-left font-mono text-sm text-apt-text hover:text-apt-gold"
                            >
                              {label}
                            </button>
                          ) : (
                            <span className="min-w-0 flex-1 truncate font-mono text-sm text-apt-text">
                              {label}
                            </span>
                          )}
                          <Select
                            aria-label={`Role for ${label}`}
                            value={a.roleId}
                            disabled={busy || roles === null}
                            onChange={(e) => onChangeRole(a, e.target.value)}
                            className="w-40"
                          >
                            {roleOptions(a.roleId, a.roleName ?? a.roleSlug)}
                          </Select>
                          <Button
                            size="sm"
                            variant="destructive-ghost"
                            aria-label={`Remove ${label}`}
                            onClick={() => onRemove(a)}
                            disabled={busy}
                            className="shrink-0"
                          >
                            <Trash2 data-icon="inline-start" />
                          </Button>
                        </div>
                        {open && renderExplainer()}
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </div>

            {/* Add row — share with a subject not already listed. */}
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-apt-text-muted">
                Share with…
              </span>
              {subjects === null ? (
                <p className="text-sm text-apt-text-muted">Loading people…</p>
              ) : availableSubjects.length === 0 ? (
                <p className="text-sm text-apt-text-dim">Everyone available has been added.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    aria-label="Choose someone to share with"
                    value={addSubjectKey}
                    disabled={busy}
                    onChange={(e) => setAddSubjectKey(e.target.value)}
                    className="w-56"
                  >
                    <option value="">Choose someone…</option>
                    {availableSubjects.map((s) => (
                      <option key={keyOfSubject(s)} value={keyOfSubject(s)}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Role to grant"
                    value={addRoleId}
                    disabled={busy || roles === null}
                    onChange={(e) => setAddRoleId(e.target.value)}
                    className="w-40"
                  >
                    <option value="">Choose a role…</option>
                    {roleOptions()}
                  </Select>
                  <Button
                    size="sm"
                    onClick={onShare}
                    disabled={busy || !addSubjectKey || !addRoleId}
                  >
                    Share
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
