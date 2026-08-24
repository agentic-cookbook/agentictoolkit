// Pure helpers + the editable input shape for the Research workspace, factored
// out of the pane so they have one authoritative home (DRY) and stay unit-
// testable. Mirrors the schemas feature's `schema-model` split: the *Pane owns
// data + selection, the *Detail is fields-only, and the blank/toInput/validate/
// normalize/differs knowledge lives here.
import type {
  CreateMarkdownBody,
  ResearchDocument,
  UpdateMarkdownBody,
} from "@agentic-toolkit/data/markdown";

/** The fields the editor binds to: the raw markdown body + classification.
 *
 *  A document has no editable title — the backend DERIVES it (frontmatter, else the
 *  first line of the body) so every client shows the same one. It is therefore absent
 *  from the draft rather than present and read-only. */
export interface ResearchInput {
  content: string;
  category: string;
  tags: string[];
}

// Public route slug: lowercase, url-safe, leading alphanumeric, 2–128 chars.
// Mirrors PUBLIC_ROUTE_RE in routes/markdownDocuments.ts so the form rejects an
// invalid route before the request (and the backend index is the real guard).
export const PUBLIC_ROUTE_RE = /^[a-z0-9][a-z0-9_-]{1,127}$/;

/** The public route is 2–128 chars (PUBLIC_ROUTE_RE), so the slug is capped there. */
const MAX_ROUTE = 128;

/**
 * The slug a title suggests: lowercased, non-alphanumerics collapsed to single dashes,
 * trimmed of leading/trailing dashes, capped at the route length.
 *
 * Deliberately NOT `@agentic-toolkit/ui/lib/slug`'s `slugify`: that one enforces the USER
 * HANDLE alphabet (≤40 chars, no `_`). A paper route is a different rule with a different
 * limit, and sharing the function would silently truncate long titles at 40.
 *
 * Returns "" when the title yields nothing PUBLIC_ROUTE_RE would accept (empty, all
 * punctuation, or a single character) — an empty suggestion the caller can leave alone,
 * rather than a slug the API is guaranteed to reject.
 */
export function routeFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_ROUTE)
    .replace(/^-+|-+$/g, "");
  return PUBLIC_ROUTE_RE.test(slug) ? slug : "";
}

export function researchBlank(): ResearchInput {
  return { content: "", category: "", tags: [] };
}

export function researchToInput(doc: ResearchDocument): ResearchInput {
  return {
    content: doc.content,
    category: doc.category ?? "",
    tags: doc.tags,
  };
}

/** Trim each tag, drop empties, dedupe (first-seen order) — matches the backend
 *  normalization so a saved doc re-hydrates to a non-dirty draft. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Clean a draft just before persisting (the body stays byte-exact). */
export function researchNormalize(input: ResearchInput): ResearchInput {
  return {
    content: input.content,
    category: input.category.trim(),
    tags: normalizeTags(input.tags),
  };
}

/** Returns an error message, or null when the draft is valid. */
export function researchValidate(input: ResearchInput): string | null {
  if (!input.content.trim()) return "A document body is required.";
  if (input.category.length > 200) return "Category must be 200 characters or fewer.";
  return null;
}

/** True when the draft differs from its baseline (drives the dirty flag). */
export function researchDiffers(a: ResearchInput, b: ResearchInput): boolean {
  return (
    a.content !== b.content ||
    a.category !== b.category ||
    a.tags.length !== b.tags.length ||
    a.tags.some((tag, i) => tag !== b.tags[i])
  );
}

/** Map a normalized draft to the create payload. An empty category is omitted (the
 *  backend leaves it unset). */
export function toCreateBody(input: ResearchInput): CreateMarkdownBody {
  const body: CreateMarkdownBody = { content: input.content };
  if (input.category) body.category = input.category;
  if (input.tags.length) body.tags = input.tags;
  return body;
}

/** Map a normalized draft to the update payload. A blank category is sent as
 *  `null` to CLEAR it (the backend distinguishes null = clear from omitted =
 *  unchanged); we always send the full draft, so blank means clear here. */
export function toUpdateBody(input: ResearchInput): UpdateMarkdownBody {
  return {
    content: input.content,
    category: input.category || null,
    tags: input.tags,
  };
}

/** Distinct, sorted category labels present across a set of documents (for the
 *  filter dropdown). */
export function categoriesOf(docs: { category?: string | null }[]): string[] {
  const set = new Set<string>();
  for (const d of docs) {
    const c = d.category?.trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Distinct, sorted tags present across a set of documents (for the filter
 *  dropdown). */
export function tagsOf(docs: { tags: string[] }[]): string[] {
  const set = new Set<string>();
  for (const d of docs) for (const t of d.tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}
