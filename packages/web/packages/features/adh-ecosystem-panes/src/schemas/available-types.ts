// The catalogue of sql-table TYPES a user can add to a bucket definition,
// grouped by DB schema (`personal`, `content`, `document`). Curated to the
// top-level, user-facing tables of each schema — junction/child/version/internal
// tables are intentionally excluded (settings.privacy_grants, content.*_items,
// content.markdown_versions, content.poll_options/poll_votes (poll child rows),
// content.reactions/bookmarks (per-actor interaction logs served by their own
// owner-scoped routes), content.notes/papers (MARKER tables that merely classify a
// content.markdown doc — managed by the bespoke notes/markdown routes, never generic
// CRUD, so `markdown` is the addable type), document.blocks/operations/versions/marks).
//
// Source of truth: the backend DB schemas at
// backend/src/adh/src/db/schema/{personal,content,document}.ts (adh's repo — the same
// path tools/check-bucket-types-drift.py reads them from). This stays a
// client-side mirror because the backend doesn't expose an "addable type"
// catalogue endpoint yet. buildAvailableTypes() is the single seam — when the
// backend can classify addable types, replace its body with that fetch and
// nothing else here or in the editor changes.
//
// Drift is GUARDED: tools/check-bucket-types-drift.py (a CI gate) fails
// when this CATALOG and the backend tables diverge, so a backend table add/rename/
// remove forces a conscious update here (or to that guard's internal EXCLUDE list)
// instead of silently leaving the picker stale.

export type TypeSchema = "personal" | "content" | "document";

export interface AvailableType {
  /** Fully-qualified type id, e.g. "content.contacts". */
  id: string;
  /** DB schema this type belongs to. */
  schema: TypeSchema;
  /** Bare sql-table name, e.g. "contacts". */
  table: string;
  /** Human label for the picker. */
  label: string;
}

// Order the schemas appear in the picker.
export const TYPE_SCHEMAS: readonly TypeSchema[] = ["personal", "content", "document"];

// Bare, top-level table names per schema.
const CATALOG: Record<TypeSchema, readonly string[]> = {
  // Only the things a HUMAN uniquely has stay in personal; the profile facts moved to content
  // (storage-buckets 0101) because orgs/personas have profiles too. `notes` is gone: the old
  // annotations table was dropped in the storage-buckets contraction (migration 0106) because a
  // note ≡ a content.markdown doc — pick `content.markdown` instead.
  personal: ["education", "jobs"],
  content: [
    "keywords",
    "categories",
    "lists",
    "key_value_pairs",
    "counters",
    "events",
    "queues",
    "polls",
    "urls",
    "attachments",
    "feedback",
    "markdown",
    // Profile facts moved in from personal (storage-buckets 0101).
    "contacts",
    "locations",
    "dates",
    "tags",
    "relationships",
    "social_links",
    "addresses",
    "feed",
  ],
  document: ["documents"],
};

// Display-label overrides where naive humanizing loses intended casing.
const LABEL_OVERRIDES: Record<string, string> = { urls: "URLs" };

// Humanize a bare table name ("key_value_pairs" -> "Key Value Pairs").
function labelFor(table: string): string {
  return (
    LABEL_OVERRIDES[table] ??
    table.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function buildAvailableTypes(): AvailableType[] {
  return TYPE_SCHEMAS.flatMap((schema) =>
    CATALOG[schema].map((table) => ({
      id: `${schema}.${table}`,
      schema,
      table,
      label: labelFor(table),
    })),
  );
}

// Lazily-built id → type index, so per-render lookups (e.g. TablePermissionNode)
// don't rebuild the whole catalogue each call.
let typeIndex: Map<string, AvailableType> | null = null;

export function findAvailableType(id: string): AvailableType | undefined {
  if (!typeIndex) typeIndex = new Map(buildAvailableTypes().map((t) => [t.id, t]));
  return typeIndex.get(id);
}
