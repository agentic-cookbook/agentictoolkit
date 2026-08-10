// Local wire types for the Markdown (research documents) and Buckets clients —
// the backend row + request-body shapes the clients read/send (see
// projects/wire.ts for the pattern: these replace the hub's generated
// `SuccessBody<...>` / `RequestBody<...>` from `@agentic-toolkit/adh-api-types`, adh product
// vocabulary a generic data client must not take on). Each interface carries exactly
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
  /** Server-derived preview: up to four body lines FOLLOWING the title line, newline-separated.
   *  It is the only body text a list row has — this projection carries no `content` — so a
   *  preview under the title costs nothing extra. OPTIONAL here though the backend always sends
   *  it: a deploy older than this frontend omits it, and a preview is an aid, not a requirement. */
  excerpt?: string;
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
 *  call site ever sets it, so it's omitted. `note: true` files the new document in
 *  the owner's `notes` storage bucket — the ONLY thing that distinguishes a note
 *  from any other markdown document (see the notes client).
 *
 *  There is no `title` here or on the update body, deliberately: the backend DERIVES
 *  it from the content (frontmatter, else the first line), so one document reads the
 *  same way in every client instead of each inventing its own convention. It stays on
 *  the row types below — reading a title is not writing one. */
export interface MarkdownCreateBody {
  content: string;
  category?: string;
  tags?: string[];
  note?: boolean;
}

/** `PUT /content/markdown/{id}` body — `category` may be explicitly nulled to
 *  clear it (vs. omitted to leave unchanged). */
export interface MarkdownUpdateBody {
  content?: string;
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

/** One row of `GET /content/markdown/categories`'s `nodes`. `parentId` is what makes
 *  the category set a TREE; it is an app-level convention with no FK behind it, so a
 *  consumer folding the tree must tolerate a parent that is missing or cyclic. */
export interface MarkdownCategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

/** `GET /content/markdown/categories` — the flat NAME list every existing consumer
 *  reads, plus the same set with its structure kept. */
export interface MarkdownCategoryTreeBody {
  items: string[];
  nodes: MarkdownCategoryNode[];
}

/** One row of `GET /content/markdown/tags`'s `nodes` — the tag counterpart of
 *  {@link MarkdownCategoryNode}. The id is what ADDRESSES the tag for a rename or a
 *  delete (`/content/keywords/{id}`); a label cannot, because the links point at the id. */
export interface MarkdownKeywordNode {
  id: string;
  label: string;
}

/** `GET /content/markdown/tags` — the flat LABEL list every existing consumer reads, plus
 *  the same set with each label's row id. */
export interface MarkdownTagSetBody {
  items: string[];
  nodes: MarkdownKeywordNode[];
}

/** `POST /content/markdown/categories` body. Omit `parentId` (or send null) for a root.
 *  A name is unique per owner across the whole tree, so this never MOVES a category:
 *  re-posting a name under a different parent is a 409. */
export interface MarkdownCategoryCreateBody {
  name: string;
  parentId?: string | null;
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
