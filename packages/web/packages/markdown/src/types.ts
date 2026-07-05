/**
 * A markdown document row from the backend `content.markdown` table.
 * Inlined from the backend OpenAPI schema `components['schemas']['MarkdownDocument']`
 * so this toolkit package carries no backend contract; consumers map their own
 * row onto this shape.
 */
export interface MarkdownDocument {
  id: string
  customerId: string
  /** Ecosystem (tenant) id. */
  ecosystemId: string
  deletedAt?: string | null
  title: string
  /** Full raw markdown, byte-exact. */
  content: string
  frontmatter?: {
    [key: string]: unknown
  } | null
  /** Optional classification label. */
  category?: string | null
  /** Tag set (defaults to []). */
  tags: string[]
  /** Publication state: 'public' is readable on the public surface, 'private' is a draft. */
  visibility: 'private' | 'public'
  /** Editorial stage: 'draft' is editable; 'final' is immutable (content/title edits + version writes are rejected). */
  stage: 'draft' | 'final'
  /** Document kind: 'paper' (ordinary) or 'research' (AI-ingested, carries an adh_source frontmatter key). */
  kind: 'paper' | 'research'
  /** Public route slug (non-null iff visibility='public'); unique per author. */
  publicRoute?: string | null
  /** SHA-256 hex of content (ETag). */
  contentHash: string
  sizeBytes: number
  /** The current revision number (incremented on every edit). */
  currentVersion: number
  latestVersionId?: string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}
