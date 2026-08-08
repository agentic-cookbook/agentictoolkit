// Pure helpers + the editable input shape for the Notebook workspace, factored out of the
// pane so they have one authoritative home (DRY) and stay unit-testable. Mirrors the
// research feature's `research-model` split: the *Pane owns data + selection, the *Detail
// is fields-only, and the blank/toInput/validate/normalize/differs knowledge lives here.
//
// A note IS a markdown document (see @agentic-toolkit/data/notes), so these are the same
// four fields research edits — minus everything about PUBLISHING. There is no public-route
// regex here because a note has no public route: the notebook has no publish flow, and the
// backend never mints a `content.papers` marker for a document created through it.
import type { CreateNoteBody, Note, UpdateNoteBody } from "@agentic-toolkit/data/notes";

/** The fields the editor binds to: title + raw markdown body + classification. */
export interface NoteInput {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

export function noteBlank(): NoteInput {
  return { title: "", content: "", category: "", tags: [] };
}

export function noteToInput(note: Note): NoteInput {
  return {
    title: note.title,
    content: note.content,
    category: note.category ?? "",
    tags: note.tags,
  };
}

/** Trim each tag, drop empties, dedupe (first-seen order) — matches the backend
 *  normalization so a saved note re-hydrates to a non-dirty draft. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

/** Clean a draft just before persisting (the body stays byte-exact). */
export function noteNormalize(input: NoteInput): NoteInput {
  return {
    title: input.title.trim(),
    content: input.content,
    category: input.category.trim(),
    tags: normalizeTags(input.tags),
  };
}

/** Returns an error message, or null when the draft is valid. The limits are the
 *  backend's own (`markdownDocuments.ts`), stated here so the form refuses first. */
export function noteValidate(input: NoteInput): string | null {
  if (!input.content.trim()) return "A note body is required.";
  if (input.title.length > 500) return "Title must be 500 characters or fewer.";
  if (input.category.length > 200) return "Category must be 200 characters or fewer.";
  return null;
}

/** True when the draft differs from its baseline (drives the dirty flag). */
export function noteDiffers(a: NoteInput, b: NoteInput): boolean {
  return (
    a.title !== b.title ||
    a.content !== b.content ||
    a.category !== b.category ||
    a.tags.length !== b.tags.length ||
    a.tags.some((tag, i) => tag !== b.tags[i])
  );
}

/** Map a normalized draft to the create payload. An empty title/category is omitted
 *  (the backend derives the title and leaves the category unset). The `note` marker
 *  that files it in the owner's `notes` bucket is added by `notesApi`, not here. */
export function toCreateBody(input: NoteInput): CreateNoteBody {
  const body: CreateNoteBody = { content: input.content };
  if (input.title) body.title = input.title;
  if (input.category) body.category = input.category;
  if (input.tags.length) body.tags = input.tags;
  return body;
}

/** Map a normalized draft to the update payload. A blank category is sent as `null` to
 *  CLEAR it (the backend distinguishes null = clear from omitted = unchanged); we always
 *  send the full draft, so blank means clear here. A blank TITLE is sent as `""` for the
 *  same reason — omitting it would read as "unchanged" and the cleared field would come
 *  back filled in on the save's own response; sent empty, the backend re-derives one from
 *  the content, which is what a create with no title already does. */
export function toUpdateBody(input: NoteInput): UpdateNoteBody {
  return {
    content: input.content,
    title: input.title,
    category: input.category || null,
    tags: input.tags,
  };
}

/** Distinct, sorted tags present across a set of notes (for the filter dropdown). */
export function tagsOf(notes: { tags: string[] }[]): string[] {
  const set = new Set<string>();
  for (const note of notes) for (const tag of note.tags) set.add(tag);
  return [...set].sort((a, b) => a.localeCompare(b));
}
