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

/** The fields the editor binds to: title + raw markdown body + classification. */
export interface ResearchInput {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

// Public route slug: lowercase, url-safe, leading alphanumeric, 2–128 chars.
// Mirrors PUBLIC_ROUTE_RE in routes/markdownDocuments.ts so the form rejects an
// invalid route before the request (and the backend index is the real guard).
export const PUBLIC_ROUTE_RE = /^[a-z0-9][a-z0-9_-]{1,127}$/;

export function researchBlank(): ResearchInput {
  return { title: "", content: "", category: "", tags: [] };
}

export function researchToInput(doc: ResearchDocument): ResearchInput {
  return {
    title: doc.title,
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
    title: input.title.trim(),
    content: input.content,
    category: input.category.trim(),
    tags: normalizeTags(input.tags),
  };
}

/** Returns an error message, or null when the draft is valid. */
export function researchValidate(input: ResearchInput): string | null {
  if (!input.content.trim()) return "A document body is required.";
  if (input.title.length > 500) return "Title must be 500 characters or fewer.";
  if (input.category.length > 200) return "Category must be 200 characters or fewer.";
  return null;
}

/** True when the draft differs from its baseline (drives the dirty flag). */
export function researchDiffers(a: ResearchInput, b: ResearchInput): boolean {
  return (
    a.title !== b.title ||
    a.content !== b.content ||
    a.category !== b.category ||
    a.tags.length !== b.tags.length ||
    a.tags.some((tag, i) => tag !== b.tags[i])
  );
}

/** Map a normalized draft to the create payload. An empty title/category is
 *  omitted (the backend derives the title and leaves the category unset). */
export function toCreateBody(input: ResearchInput): CreateMarkdownBody {
  const body: CreateMarkdownBody = { content: input.content };
  if (input.title) body.title = input.title;
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
    title: input.title || undefined,
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
