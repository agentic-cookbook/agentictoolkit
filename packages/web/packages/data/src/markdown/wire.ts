// Local wire types for the Markdown (research documents) and Buckets clients —
// the backend row + request-body shapes the clients read/send (see
// projects/wire.ts for the pattern: these replace the hub's generated
// `SuccessBody<...>` / `RequestBody<...>` from `@adh-shared/api-types`, a
// monorepo coupling the toolkit can't take). Each interface carries exactly
// the fields the mappers/call sites touch.
// Type-only file.

/* ── Markdown (research documents) ───────────────────────────────────────
 * Backend surface: /content/markdown (see websites/backend/src/routes/
 * markdownDocuments.ts). Narrowed to the fields the hub's ResearchPane /
 * ResearchDetail / PublishSection / ResearchFilters / research-model.ts
 * actually read: id, title, content, category, tags, visibility, publicRoute.
 */

/** A full document, body included (GET /content/markdown/:id, and the
 *  create/update/publish responses). */
export interface MarkdownDocumentRow {
  id: string;
  title: string;
  content: string;
  category?: string | null;
  tags: string[];
  visibility: "private" | "public";
  publicRoute?: string | null;
}

/** Document metadata only — no body (the list/search rows). */
export interface MarkdownDocumentSummaryRow {
  id: string;
  title: string;
  category?: string | null;
  tags: string[];
  visibility: "private" | "public";
  publicRoute?: string | null;
}

/** `GET /content/markdown` response — only `items` is read here. */
export interface MarkdownListResponse {
  items: MarkdownDocumentSummaryRow[];
}

/** `POST /content/markdown` body. `author` exists on the backend but no hub
 *  call site ever sets it, so it's omitted. */
export interface MarkdownCreateBody {
  content: string;
  title?: string;
  category?: string;
  tags?: string[];
}

/** `PUT /content/markdown/{id}` body — `category` may be explicitly nulled to
 *  clear it (vs. omitted to leave unchanged). */
export interface MarkdownUpdateBody {
  content?: string;
  title?: string;
  category?: string | null;
  tags?: string[];
}

/** `POST /content/markdown/{id}/publish` body. */
export interface MarkdownPublishBody {
  route: string;
}

/** `{ items: string[] }` — shared shape of the categories/tags list responses. */
export interface StringListBody {
  items: string[];
}

/* ── Buckets (bucket.buckets + bucket.bucket_types) ──────────────────────
 * Backend surface: /bucket/buckets, /bucket/bucket-types. `metadata` is an
 * untyped jsonb column on the generated spec; BucketRow keeps the refined
 * `{ description? }` shape this client actually reads.
 */

/** Backend row for `GET /bucket/buckets` (and a single bucket). */
export interface BucketRow {
  id: string;
  ecosystemId: string;
  name: string;
  kind: string;
  metadata: { description?: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** `POST /bucket/buckets` body. */
export interface BucketCreateBody {
  name: string;
  metadata: { description?: string };
  ecosystemId?: string;
}

/** `PUT /bucket/buckets/{id}` body. */
export interface BucketPutBody {
  name?: string;
  metadata?: { description?: string };
}

/** Backend row for `GET /bucket/bucket-types` (and a single bucket-type). */
export interface BucketTypeRow {
  id: string;
  bucketId: string;
  sqlTableName: string;
  name: string;
}

/** `POST /bucket/bucket-types` body. */
export interface BucketTypeCreateBody {
  bucketId: string;
  ecosystemId: string;
  sqlTableName: string;
  name: string;
}
