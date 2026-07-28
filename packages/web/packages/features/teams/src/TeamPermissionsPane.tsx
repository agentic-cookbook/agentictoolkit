"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Shield } from "lucide-react";

import {
  accessApi,
  ACCESS_FEATURES,
  type AccessGrantRow,
  type AccessRoleRow,
} from "@agentic-toolkit/data/access";
import {
  ButtonBar,
  CreateResourceDialog,
  DetailSection,
  useMasterDetailForm,
  useMasterDetailLevel,
  type TopicLeaf,
} from "@agentic-toolkit/resource";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { PermissionToggles } from "@agentic-toolkit/ui/components/permission-toggles";
import type { Crud } from "@agentic-toolkit/ui/components/crud";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Field, FieldGroup, TopicSelectHint } from "@agentic-toolkit/ui/blocks";
import { cn } from "@agentic-toolkit/ui/lib/utils";

// A role slug is lowercase and dash-joined (matches the server's own key). Validated
// only on create — slugs are immutable afterwards (the PATCH surface omits `slug`).
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Parse a comma-letter verb string into the CRUD model + the separate `manage`
 * (M) flag. Unknown letters are dropped, so a garbage or reordered server string
 * round-trips to canonical form via {@link formatVerbs}. Sub-item strings (CRUD
 * only) parse the same way — their `manage` is simply ignored by the caller.
 */
export function parseVerbs(s: string): { crud: Crud; manage: boolean } {
  const set = new Set(
    s
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean),
  );
  return {
    crud: {
      create: set.has("C"),
      read: set.has("R"),
      update: set.has("U"),
      delete: set.has("D"),
    },
    manage: set.has("M"),
  };
}

/** Emit the canonical `C,R,U,D,M` order, filtered to the enabled verbs (e.g. R+M ⇒ "R,M").
 *  Sub-item editors pass `manage=false` so the M column can never leak into a CRUD-only string. */
export function formatVerbs(crud: Crud, manage: boolean): string {
  const out: string[] = [];
  if (crud.create) out.push("C");
  if (crud.read) out.push("R");
  if (crud.update) out.push("U");
  if (crud.delete) out.push("D");
  if (manage) out.push("M");
  return out.join(",");
}

// Canonicalize a stored grant so the draft baseline matches what the toggles emit —
// otherwise a non-canonical server string (same verb set, different order) reads as dirty.
const canonItem = (s: string): string => {
  const { crud, manage } = parseVerbs(s);
  return formatVerbs(crud, manage);
};
const canonSub = (s: string): string => formatVerbs(parseVerbs(s).crud, false);

/** The editable draft: `slug` is meaningful only while creating; `grants` is always
 *  one canonical row per ACCESS_FEATURES (in that order) so index-aligned diffing works, and
 *  `carried` holds the grants this pane does NOT render (see {@link carriedGrantsFor}). The two
 *  are kept in SEPARATE arrays precisely so that invariant survives: everything the matrix
 *  renders, edits, and diffs is `grants`, and nothing else can ever land in it. */
interface RoleInput {
  slug: string;
  name: string;
  description: string;
  defaultFor: "" | "customer" | "persona";
  grants: AccessGrantRow[];
  carried: AccessGrantRow[];
}

const blankGrants = (): AccessGrantRow[] =>
  ACCESS_FEATURES.map((f) => ({ feature: f.key, itemVerbs: "", subitemVerbs: "" }));

const isRenderedFeature = (feature: string): boolean =>
  ACCESS_FEATURES.some((f) => f.key === feature);

// Project a role's grants onto the fixed ACCESS_FEATURES rows (missing features ⇒ empty),
// canonicalized — so every draft has the same shape regardless of what the server sent.
const grantsFor = (role: AccessRoleRow): AccessGrantRow[] =>
  ACCESS_FEATURES.map((f) => {
    const g = role.grants.find((x) => x.feature === f.key);
    return {
      feature: f.key,
      itemVerbs: canonItem(g?.itemVerbs ?? ""),
      subitemVerbs: canonSub(g?.subitemVerbs ?? ""),
    };
  });

/**
 * The role's grants for feature areas this build does NOT render, copied VERBATIM so they can be
 * resubmitted byte-for-byte on save.
 *
 * ACCESS_FEATURES is a fixed list shared by every product built on this toolkit, but the BACKEND's
 * feature-area registry is per-deployment — a server can, and does, hold grants for areas this pane
 * knows nothing about. Save is a FULL REPLACEMENT (the server deletes every grant row and
 * re-inserts exactly what we send), and a feature missing from that payload is recorded as a
 * DELIBERATE revocation, which the deploy-time role backfill then honors by refusing to restore it.
 * So a grant dropped here is destroyed permanently and silently, by an admin who only wanted to
 * tick a box on some unrelated row. Carrying the rows through means this pane can only ever change
 * what it actually shows.
 *
 * Deliberately NOT canonicalized: we make no claim about verbs we don't understand, and round-trip
 * fidelity is the whole point. The server canonicalizes on write anyway.
 */
const carriedGrantsFor = (role: AccessRoleRow): AccessGrantRow[] =>
  role.grants.filter((g) => !isRenderedFeature(g.feature)).map((g) => ({ ...g }));

/** What actually goes on the wire: the edited matrix plus the untouched carried rows. Every
 *  submit path (create AND update) must use this — the payload is a full replacement, so a caller
 *  that sends `draft.grants` alone silently revokes everything in `carried`. */
const submitGrants = (d: RoleInput): AccessGrantRow[] => [...d.grants, ...d.carried];

// Only the RENDERED rows participate: they are the sole thing the user can change, and both sides
// of the comparison are built by grantsFor, so they are index-aligned by construction. `carried` is
// never edited (nothing in the UI reaches it), so it is identical in draft and baseline — including
// it could only ever report false, while giving up the length/index guarantee this relies on.
const grantsDiffer = (a: AccessGrantRow[], b: AccessGrantRow[]): boolean =>
  a.length !== b.length ||
  a.some((g, i) => g.itemVerbs !== b[i]!.itemVerbs || g.subitemVerbs !== b[i]!.subitemVerbs);

const isAdminRole = (role: AccessRoleRow | null): boolean =>
  role != null && role.isSystem && role.slug === "admin";

/**
 * The Teams "Permissions" topic: the workspace ROLES editor
 * (docs/workspace-roles-permissions.md). Roles are admin-defined verb bundles per
 * feature area. Built on the shared MasterDetailForm/Level substrate like the sibling
 * AccessPane: the roles list is PUBLISHED as a rail level (master), and this pane
 * renders the selected role's editor (detail). Every call names the workspace by slug.
 */
export function TeamPermissionsPane({
  workspaceSlug,
  leaf,
}: {
  /** The workspace whose roles this edits (a customer or org slug). Absent ⇒ the defined
   *  empty state, never a spinner — the pane is only useful mounted from a hub workspace. */
  workspaceSlug?: string;
  /** Unused: the breadcrumb names the pane now (kept for the topic render prop shape). */
  title?: ReactNode;
  /** Deep-linkable role selection (`…/permissions/<roleId>`). */
  leaf?: TopicLeaf;
}) {
  const [roles, setRoles] = useState<AccessRoleRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Creating a role is a MODAL over the stack, never a blank leaf (HTD recipe
  // `must-create-in-modal`): the `+` opens it, and on save the new role is selected so its
  // REAL detail (the per-feature permission matrix + default-for) opens.
  const [newOpen, setNewOpen] = useState(false);

  // Latest-wins guard: a stale in-flight list (from a previous slug) never clobbers the current one.
  const gen = useRef(0);
  const refresh = useCallback(async () => {
    const g = ++gen.current;
    // No workspace ⇒ a DEFINED empty list (not null), so the rail shows the "open from your hub"
    // message rather than an eternal "Loading…" spinner.
    if (!workspaceSlug) {
      setRoles([]);
      return;
    }
    setLoadError(null);
    try {
      const rows = await accessApi.listRoles(workspaceSlug);
      if (g !== gen.current) return;
      setRoles(rows);
    } catch (err) {
      if (g !== gen.current) return;
      setRoles([]);
      setLoadError(err instanceof Error ? err.message : "Failed to load roles.");
    }
  }, [workspaceSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const urlSelection = leaf ? { selectedId: leaf.leafId, onSelect: leaf.onSelect } : undefined;

  // The role draft's placement rules — slug + name + description — extracted so the form (edit)
  // and the create MODAL share one source of truth. `defaultFor` and the permission matrix are
  // NOT placement; they live in the detail that opens once the created role is selected, so a new
  // role is created with no grants and the user configures them there.
  const roleBlank = (): RoleInput => ({
    slug: "",
    name: "",
    description: "",
    defaultFor: "",
    grants: blankGrants(),
    // Nothing to carry: `blank()` is only ever the starting draft for a CREATE (the hook calls it
    // from `create()`, and the create modal from its own `blank` prop) — it is never merged onto an
    // existing row, so there are no server grants in play yet.
    carried: [],
  });
  const roleValidate = (draft: RoleInput, others: AccessRoleRow[]): string | null => {
    // Slug is validated unconditionally (not just while creating): existing slugs already
    // satisfy this, and `others` excludes the selected row so a role never collides with
    // itself. The slug field only SHOWS while creating (it's immutable afterwards).
    const slug = draft.slug.trim().toLowerCase();
    if (!slug) return "Slug is required.";
    if (!SLUG_RE.test(slug)) return "Slug must be lowercase letters, numbers, and dashes.";
    if (others.some((o) => o.slug === slug))
      return `A role with the slug "${slug}" already exists.`;
    if (!draft.name.trim()) return "Name is required.";
    return null;
  };
  const roleNormalize = (d: RoleInput): RoleInput => ({
    slug: d.slug.trim().toLowerCase(),
    name: d.name.trim(),
    description: d.description.trim(),
    defaultFor: d.defaultFor,
    grants: d.grants,
    carried: d.carried,
  });
  const createRole = async (input: RoleInput): Promise<AccessRoleRow> => {
    // Guarded for safety — the pane is unreachable for create without a workspace, but a
    // clear rejection beats a thrown `enc(undefined)` if that ever changes.
    if (!workspaceSlug) throw new Error("Open Teams from your hub workspace to manage roles.");
    return accessApi.createRole(workspaceSlug, {
      slug: input.slug,
      name: input.name,
      description: input.description,
      defaultFor: input.defaultFor,
      grants: submitGrants(input),
    });
  };

  const form = useMasterDetailForm<AccessRoleRow, RoleInput>({
    items: roles,
    getId: (r) => r.id,
    urlSelection,
    blank: roleBlank,
    toInput: (r) => ({
      slug: r.slug,
      name: r.name,
      description: r.description,
      defaultFor: (r.defaultFor === "customer" || r.defaultFor === "persona" ? r.defaultFor : ""),
      grants: grantsFor(r),
      carried: carriedGrantsFor(r),
    }),
    validate: roleValidate,
    differs: (a, b) =>
      a.slug !== b.slug ||
      a.name.trim() !== b.name.trim() ||
      a.description.trim() !== b.description.trim() ||
      a.defaultFor !== b.defaultFor ||
      grantsDiffer(a.grants, b.grants),
    normalize: roleNormalize,
    create: createRole,
    update: async (id, input) => {
      if (!workspaceSlug) throw new Error("Open Teams from your hub workspace to manage roles.");
      return accessApi.updateRole(workspaceSlug, id, {
        name: input.name,
        description: input.description,
        defaultFor: input.defaultFor,
        grants: submitGrants(input),
      });
    },
    // Only custom roles are deletable; the affordance is hidden for system roles (below), and
    // the server 403s besides. A 409 while assignments still reference the role surfaces inline.
    remove: (role) => {
      if (!workspaceSlug) return Promise.reject(new Error("No workspace to delete from."));
      return accessApi.deleteRole(workspaceSlug, role.id);
    },
    confirmDelete: (role) =>
      `Delete role "${role.name}"? Members assigned only this role fall back to the workspace default.`,
    refresh,
    createLabel: "New role",
  });

  // PUBLISH the roles as a rail level (master) + register the editor's unsaved-work guard.
  useMasterDetailLevel({
    id: "roles-list",
    title: "Roles",
    form,
    items: roles,
    getId: (r) => r.id,
    getLabel: (r) => r.name,
    getSublabel: (r) => r.slug,
    itemIcon: <Shield size={16} aria-hidden />,
    newLabel: "New role",
    leaf,
    emptyLabel:
      roles === null
        ? "Loading…"
        : !workspaceSlug
          ? "Open Teams from your hub workspace to manage roles."
          : "No roles yet.",
    // No workspace ⇒ no create affordance (the pane is only usable from a hub workspace; the
    // empty state says so). Elsewhere the `+` opens the scoped create modal.
    onNew: workspaceSlug ? () => setNewOpen(true) : undefined,
  });

  const selected = form.selected;
  const adminSelected = isAdminRole(selected);

  const help = (
    <p>
      Roles bundle what members can do, per feature area. Item verbs cover top-level items —
      C/R/U/D plus M (manage access &amp; delegation); sub-item verbs cover their children. System
      roles are built in; the admin role is always full access.
    </p>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ErrorText error={loadError} className="px-6 pt-4" />
      {/* The immutable admin role gets no editing bar at all (no save/delete affordances); every
          other role edits through the shared bar. Delete shows only for custom (non-system) roles. */}
      {!adminSelected && (
        <ButtonBar
          actions={form.actions}
          showCreate={false}
          showDelete={selected != null && !selected.isSystem}
          help={help}
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        {form.editing && form.draft ? (
          <RoleDetail
            key={form.detailKey}
            title="Role"
            draft={form.draft}
            onChange={form.onChange}
            error={form.error}
            creating={form.creating}
            selected={selected}
          />
        ) : roles === null ? (
          <EmptyState title="Loading…" />
        ) : !workspaceSlug ? (
          <EmptyState title="Open Teams from your hub workspace to manage roles." />
        ) : (
          <TopicSelectHint title="Select a role to edit, or create a new one." />
        )}
      </div>

      {/* Create is a scoped modal: slug + name + description only (the permission matrix and
          default-for live in the role's real detail, which opens once the role is selected). */}
      {newOpen && (
        <CreateResourceDialog<RoleInput, AccessRoleRow>
          ariaLabel="New role"
          heading="New role"
          blank={roleBlank}
          validate={(d) => roleValidate(d, roles ?? [])}
          create={(d) => createRole(roleNormalize(d))}
          onClose={() => setNewOpen(false)}
          onCreated={(role) => {
            setNewOpen(false);
            void refresh();
            if (leaf) leaf.onSelect(role.id);
            else form.select(role.id);
          }}
          renderForm={(draft, onChange, error) => (
            <>
              <Field label="Slug" hint="Lowercase letters, numbers, and dashes. Can't change later.">
                <Input
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
                  autoFocus
                  value={draft.slug}
                  placeholder="reviewer"
                  onChange={(e) => onChange({ ...draft, slug: e.target.value.toLowerCase() })}
                />
              </Field>
              <Field label="Name">
                <Input
                  value={draft.name}
                  placeholder="Reviewer"
                  onChange={(e) => onChange({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={2}
                  value={draft.description}
                  placeholder="What this role is for."
                  onChange={(e) => onChange({ ...draft, description: e.target.value })}
                />
              </Field>
              <ErrorText error={error} />
            </>
          )}
        />
      )}
    </div>
  );
}

/** The selected role's editor: identity fields + the per-feature verb matrix. The admin
 *  role renders fully disabled with an immutability note; other system roles are editable
 *  (their slug is fixed, so the slug field only shows while creating). */
function RoleDetail({
  title,
  draft,
  onChange,
  error,
  creating,
  selected,
}: {
  title: string;
  draft: RoleInput;
  onChange: (next: RoleInput) => void;
  error?: string | null;
  creating: boolean;
  selected: AccessRoleRow | null;
}) {
  const admin = isAdminRole(selected);
  const disabled = admin; // the whole admin form is locked; every field + toggle disables

  return (
    <DetailSection
      title={title}
      action={selected?.isSystem ? <Badge variant="neutral">System</Badge> : undefined}
    >
      <Card>
        <CardContent className="flex flex-col gap-5">
          {creating && (
            <Field label="Slug" hint="Lowercase letters, numbers, and dashes. Can't change later.">
              <Input
                value={draft.slug}
                placeholder="reviewer"
                onChange={(e) => onChange({ ...draft, slug: e.target.value.toLowerCase() })}
              />
            </Field>
          )}

          <Field label="Name">
            <Input
              value={draft.name}
              disabled={disabled}
              placeholder="Reviewer"
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
            />
          </Field>

          <Field label="Description">
            <Textarea
              rows={2}
              value={draft.description}
              disabled={disabled}
              placeholder="What this role is for."
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
            />
          </Field>

          <Field label="Default for" hint="Members of this kind get this role automatically.">
            <Select
              value={draft.defaultFor}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...draft, defaultFor: e.target.value as RoleInput["defaultFor"] })
              }
            >
              <option value="">No one</option>
              <option value="customer">Human members</option>
              <option value="persona">Personas</option>
            </Select>
          </Field>

          {/* Form-level error (slug / name / a rejected save) — not bound to a single field. */}
          <ErrorText error={error} />
        </CardContent>
      </Card>

      {admin && (
        <p className="text-xs text-apt-text-muted">The admin role is immutable.</p>
      )}

      {/* `draft.grants` is exactly the ACCESS_FEATURES rows, in order, by construction — so this map
          is complete and its index `i` is the same index the dirty check walks. `draft.carried`
          (grants for feature areas this build has no label for) is deliberately NOT rendered: it
          rides along untouched to the save payload. Showing a raw feature key with live toggles
          would invite an admin to edit verbs the pane cannot even describe. The label fallback
          below is therefore unreachable, and kept only so a broken invariant degrades to a visible
          key rather than a blank row. */}
      <FieldGroup title="Permissions">
        {draft.grants.map((grant, i) => (
          <FeatureGrantRow
            key={grant.feature}
            label={ACCESS_FEATURES.find((f) => f.key === grant.feature)?.label ?? grant.feature}
            grant={grant}
            disabled={disabled}
            onChange={(next) =>
              onChange({ ...draft, grants: draft.grants.map((g, j) => (j === i ? next : g)) })
            }
          />
        ))}
      </FieldGroup>
    </DetailSection>
  );
}

/** One feature area's two verb editors: item verbs (CRUD via PermissionToggles + the M chip) and
 *  sub-item verbs (CRUD only). Captioned "Items" / "Sub-items". */
function FeatureGrantRow({
  label,
  grant,
  disabled,
  onChange,
}: {
  label: string;
  grant: AccessGrantRow;
  disabled: boolean;
  onChange: (next: AccessGrantRow) => void;
}) {
  const { crud: itemCrud, manage } = parseVerbs(grant.itemVerbs);
  const subCrud = parseVerbs(grant.subitemVerbs).crud;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-apt-border bg-apt-bg p-3">
      <span className="text-sm font-medium text-apt-text">{label}</span>
      <div className="flex items-center gap-3">
        <span className="w-16 text-xs text-apt-text-muted">Items</span>
        <PermissionToggles
          value={itemCrud}
          disabled={disabled}
          onChange={(crud) => onChange({ ...grant, itemVerbs: formatVerbs(crud, manage) })}
        />
        <ManageChip
          on={manage}
          disabled={disabled}
          onToggle={() => onChange({ ...grant, itemVerbs: formatVerbs(itemCrud, !manage) })}
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="w-16 text-xs text-apt-text-muted">Sub-items</span>
        <PermissionToggles
          value={subCrud}
          disabled={disabled}
          onChange={(crud) => onChange({ ...grant, subitemVerbs: formatVerbs(crud, false) })}
        />
      </div>
    </div>
  );
}

/** The fifth "M" (manage access) chip PermissionToggles doesn't render — styled to match its
 *  CRUD chips (size-7 rounded border, gold when on). M = grant/revoke assignments + restrict items. */
function ManageChip({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle()}
      disabled={disabled}
      aria-pressed={on}
      title="Manage access (delegation)"
      className={cn(
        "flex size-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
        on
          ? "border-apt-gold bg-apt-gold/20 text-apt-gold-bright"
          : "border-apt-border bg-apt-bg text-apt-text-muted hover:text-apt-text",
        disabled && "cursor-not-allowed opacity-40 hover:text-apt-text-muted",
      )}
    >
      M
    </button>
  );
}
