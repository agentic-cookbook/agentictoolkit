"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { Shield } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { isNotFound, useResourceList } from "@agentic-toolkit/data";
import {
  accessApi,
  ACCESS_FEATURES,
  type AccessFeatureRow,
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
 *  one canonical row per RENDERED feature area (in that order) so index-aligned diffing works, and
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

/**
 * The rendered feature areas are a RUNTIME value, not a constant — the pane asks the backend
 * for its own registry and falls back to {@link ACCESS_FEATURES} (see `loadFeatures` below).
 * So every projection below takes the list it must project onto; none may reach for the
 * hardcoded constant, or the fallback path and the resolved path would disagree about which
 * rows are "rendered" — the exact question `carried` turns on.
 */
const blankGrants = (features: readonly AccessFeatureRow[]): AccessGrantRow[] =>
  features.map((f) => ({ feature: f.key, itemVerbs: "", subitemVerbs: "" }));

const isRenderedFeature = (features: readonly AccessFeatureRow[], feature: string): boolean =>
  features.some((f) => f.key === feature);

// Project a role's grants onto the rendered feature rows (missing features ⇒ empty),
// canonicalized — so every draft has the same shape regardless of what the server sent.
const grantsFor = (
  features: readonly AccessFeatureRow[],
  role: AccessRoleRow,
): AccessGrantRow[] =>
  features.map((f) => {
    const g = role.grants.find((x) => x.feature === f.key);
    return {
      feature: f.key,
      itemVerbs: canonItem(g?.itemVerbs ?? ""),
      subitemVerbs: canonSub(g?.subitemVerbs ?? ""),
    };
  });

/**
 * The role's grants for feature areas this pane is NOT rendering, copied VERBATIM so they can be
 * resubmitted byte-for-byte on save.
 *
 * The BACKEND's feature-area registry is per-deployment, and this pane is shared by every product
 * built on the toolkit. It now ASKS for that registry — but the ask can fail (an older product's
 * backend has no such endpoint at all), and then the matrix renders the two-area
 * {@link ACCESS_FEATURES} fallback while the server still holds grants for areas beyond it. This
 * function is what makes that fallback safe. Save is a FULL REPLACEMENT (the server deletes every
 * grant row and re-inserts exactly what we send), and a feature missing from that payload is
 * recorded as a DELIBERATE revocation, which the deploy-time role backfill then honors by refusing
 * to restore it. So a grant dropped here is destroyed permanently and silently, by an admin who
 * only wanted to tick a box on some unrelated row. Carrying the rows through means this pane can
 * only ever change what it actually shows — which is precisely the guarantee a degraded feature
 * fetch needs, so this must NOT be folded into `grants` on the theory that the list is now
 * complete. It is complete only when the fetch succeeded.
 *
 * Deliberately NOT canonicalized: we make no claim about verbs we don't understand, and round-trip
 * fidelity is the whole point. The server canonicalizes on write anyway.
 */
const carriedGrantsFor = (
  features: readonly AccessFeatureRow[],
  role: AccessRoleRow,
): AccessGrantRow[] =>
  role.grants.filter((g) => !isRenderedFeature(features, g.feature)).map((g) => ({ ...g }));

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

/** The stand-in for a roles read that FAILED — module scope so it is one identity for the whole
 *  process, since it is what `useMasterDetailForm`/`useMasterDetailLevel` compare `items` against. */
const NO_ROLES: AccessRoleRow[] = [];

const isAdminRole = (role: AccessRoleRow | null): boolean =>
  role != null && role.isSystem && role.slug === "admin";

/**
 * The Teams "Permissions" topic: the workspace ROLES editor
 * (docs/workspace-roles-permissions.md). Roles are admin-defined verb bundles per
 * feature area — and WHICH areas exist is the backend's answer (`GET /access/features`), not a
 * constant here, so a custom role can grant and withhold every area the server enforces rather
 * than the subset this package happened to be built with. Built on the shared
 * MasterDetailForm/Level substrate like the sibling
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
  // Creating a role is a MODAL over the stack, never a blank leaf (HTD recipe
  // `must-create-in-modal`): the `+` opens it, and on save the new role is selected so its
  // REAL detail (the per-feature permission matrix + default-for) opens.
  const [newOpen, setNewOpen] = useState(false);

  // The feature areas the matrix RENDERS. The backend's registry is the authority (it refines
  // every submitted grant against it, and it is what the system roles were seeded from), so the
  // pane asks for it — but this pane ships in products whose backend has no such endpoint, so an
  // unreadable answer degrades to the hardcoded ACCESS_FEATURES and the pane behaves exactly as
  // it did before.
  //
  // Cached per workspace, which is what retires this pane's own feature-cache ref AND its
  // latest-wins generation counter: the query cache holds a resolved list across unmounts (the ref
  // never did), and a reply for a previous workspace is a different cache entry rather than
  // something a counter has to reject. The rule the ref encoded is kept — a failure is NOT cached,
  // so it is retried on the next visit — by THROWING here instead of returning the fallback.
  // Caching the fallback would pin a transient hiccup to the two hardcoded rows with no retry.
  const loadFeatures = useCallback(async (): Promise<AccessFeatureRow[]> => {
    if (!workspaceSlug) return [...ACCESS_FEATURES];
    let rows: AccessFeatureRow[];
    try {
      rows = await accessApi.listFeatures(workspaceSlug);
    } catch (err) {
      // A 404 is the expected degrade path — a product whose backend predates this endpoint — and
      // must stay silent, matching the pre-endpoint behavior this pane is required to reproduce
      // exactly. It is also the one failure worth CACHING: a backend without the endpoint will
      // 404 forever, so re-asking every visit buys nothing. Anything else (a malformed body —
      // `listFeatures` validates the shape and throws — a 5xx, or a network failure) is
      // unexpected: report it the way this codebase reports comparable failures (see
      // useMasterDetailForm's save/delete catches) and rethrow, so it surfaces in the banner and
      // a transient blip doesn't masquerade as an old backend with no sign anything went wrong.
      if (isNotFound(err)) return [...ACCESS_FEATURES];
      reportUnexpectedAuthError(err, { feature: "team-permissions", step: "loadFeatures" });
      throw err;
    }
    // An EMPTY answer counts as unreadable, NOT as "this backend enforces nothing": zero rows
    // would render a role editor that can grant nothing, and silently sweep every existing grant
    // into `carried`. The fallback is the safer reading of a nonsensical answer — and it is
    // exactly as unexpected as a malformed body: no deployment enforces nothing, and
    // `listFeatures` resolves this shape rather than throwing (a well-formed empty list is a valid
    // response at that layer — deciding it is unusable is THIS pane's call). Reported and surfaced
    // on the same footing, or it would be the one unreadable answer that degrades with no sign
    // anything went wrong.
    if (rows.length > 0) return rows;
    reportUnexpectedAuthError(new Error("GET /access/features returned an empty list"), {
      feature: "team-permissions",
      step: "loadFeatures",
    });
    throw new Error("The feature list came back empty. Showing the default list instead.");
  }, [workspaceSlug]);

  // `reportErrors: false` because `loadFeatures` above already reports, with the step that failed
  // and — for the empty answer — an engineer-facing message the thrown one deliberately isn't.
  const {
    items: featureRows,
    reload: reloadFeatures,
    error: featuresError,
  } = useResourceList<AccessFeatureRow>(
    `workspace:${workspaceSlug ?? ""}:access-features`,
    loadFeatures,
    { reportErrors: false },
  );
  // Unreadable ⇒ the hardcoded list, which is what every throw above degrades to.
  const features: readonly AccessFeatureRow[] = featureRows ?? ACCESS_FEATURES;
  // The server has ANSWERED about the feature list — landed or failed. Not "succeeded": a failure
  // settles the matrix onto the fallback just as finally as a success settles it onto the server's.
  const featuresSettled = featureRows !== null || featuresError !== null;

  const loadRoles = useCallback((): Promise<AccessRoleRow[]> => {
    // No workspace ⇒ a DEFINED empty list (not null), so the rail shows the "open from your hub"
    // message rather than an eternal "Loading…" spinner.
    if (!workspaceSlug) return Promise.resolve([]);
    // Features FIRST: no role is readable until the list it will be projected onto is final.
    // `toInput`/`differs` close over `features`, and the master/detail hook re-derives the baseline
    // from `toInput` on every render — so a draft built against one list and re-based against
    // another would diff index-misaligned rows and could submit a grant under the wrong feature
    // key. A promise that never settles is how this hook is held in Loading; the moment the
    // features read answers, THIS fetcher's identity changes and the hook cancels the wait and
    // reads for real.
    if (!featuresSettled) return new Promise<AccessRoleRow[]>(() => {});
    return accessApi.listRoles(workspaceSlug);
  }, [workspaceSlug, featuresSettled]);

  const {
    items: loadedRoles,
    reload: reloadRoles,
    error: rolesError,
    isFetching,
  } = useResourceList<AccessRoleRow>(`workspace:${workspaceSlug ?? ""}:access-roles`, loadRoles);

  // TWO reads, one refresh. A save/delete re-reads the feature list as well as the roles, which is
  // what keeps a feature list that was unreadable at mount from staying unreadable for the rest of
  // the session: nothing else ever re-asks, because a failure is not cached and the fetcher's
  // identity does not change while the workspace holds still. Features first — a role is projected
  // onto that list — and swallowed, since its failure is already in `featuresError` and the banner,
  // and it must not fail the save flow that called this.
  const refresh = useCallback(async () => {
    await reloadFeatures().catch(() => {});
    await reloadRoles();
  }, [reloadFeatures, reloadRoles]);

  // A failed read used to be substituted with `[]` so the pane didn't hang on "Loading…" forever;
  // the hook leaves `items` null instead, so make that substitution here.
  const roles = loadedRoles ?? (rolesError ? NO_ROLES : null);
  // One banner, two reads. Roles wins when both failed: it is the one that emptied the list, and
  // the feature failure has already been absorbed into the fallback matrix.
  const loadError = rolesError ?? featuresError;

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
    grants: blankGrants(features),
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
      grants: grantsFor(features, r),
      carried: carriedGrantsFor(features, r),
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
    // The spinner before "Roles" — the only thing that says a revalidation is running behind rows
    // the cache already put on screen. `emptyLabel` covers the FIRST read and nothing after.
    busy: isFetching,
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
            features={features}
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
  features,
  draft,
  onChange,
  error,
  creating,
  selected,
}: {
  title: string;
  /** The rendered feature areas — the same list `draft.grants` was projected onto, so the
   *  label lookup below and the row order agree by construction. */
  features: readonly AccessFeatureRow[];
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

      {/* `draft.grants` is exactly the `features` rows, in order, by construction — so this map
          is complete and its index `i` is the same index the dirty check walks. `draft.carried`
          (grants for feature areas this pane is not rendering — only ever non-empty when the
          server's registry could not be read) is deliberately NOT rendered: it rides along
          untouched to the save payload. Showing a raw feature key with live toggles would invite
          an admin to edit verbs the pane cannot even describe. The label fallback below is
          therefore unreachable, and kept only so a broken invariant degrades to a visible key
          rather than a blank row. */}
      <FieldGroup title="Permissions">
        {draft.grants.map((grant, i) => (
          <FeatureGrantRow
            key={grant.feature}
            label={features.find((f) => f.key === grant.feature)?.label ?? grant.feature}
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
