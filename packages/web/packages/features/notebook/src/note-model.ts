// Pure helpers + the editable input shape for the Notebook workspace, factored out of the
// pane so they have one authoritative home (DRY) and stay unit-testable. Mirrors the
// research feature's `research-model` split: the *Pane owns data + selection, the *Detail
// is fields-only, and the blank/toInput/validate/normalize/differs knowledge lives here.
//
// A note IS a markdown document (see @agentic-toolkit/data/notes), so these are the same
// four fields research edits — minus everything about PUBLISHING. There is no public-route
// regex here because a note has no public route: the notebook has no publish flow, and the
// backend never mints a `content.papers` marker for a document created through it.
import type {
  CreateNoteBody,
  Note,
  UpdateNoteBody,
} from "@agentic-toolkit/data/notes";

/** The fields the editor binds to: the raw markdown body + classification.
 *
 *  A note has no title of its own — the title IS the first line of the body, derived
 *  by the backend so every client shows the same one. Nothing here edits it, which is
 *  why it is absent from the draft rather than present and read-only. */
export interface NoteInput {
  content: string;
  category: string;
  tags: string[];
}

export function noteBlank(): NoteInput {
  return { content: "", category: "", tags: [] };
}

export function noteToInput(note: Note): NoteInput {
  return {
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
    content: input.content,
    category: input.category.trim(),
    tags: normalizeTags(input.tags),
  };
}

/** Returns an error message, or null when the draft is valid. The limits are the
 *  backend's own (`markdownDocuments.ts`), stated here so the form refuses first.
 *
 *  `itemNoun` is the corpus's singular — "note", "document" — so the one message a user
 *  actually reads names the thing they are writing. It is a bare string rather than the
 *  `CorpusNoun` object because this module is pure and deliberately holds no import of the
 *  corpus descriptors (which carry React icons and the data clients). */
export function noteValidate(
  input: NoteInput,
  itemNoun = "note",
): string | null {
  if (!input.content.trim()) return `A ${itemNoun} body is required.`;
  if (input.category.length > 200)
    return "Category must be 200 characters or fewer.";
  return null;
}

/** True when the draft differs from its baseline (drives the dirty flag). */
export function noteDiffers(a: NoteInput, b: NoteInput): boolean {
  return (
    a.content !== b.content ||
    a.category !== b.category ||
    a.tags.length !== b.tags.length ||
    a.tags.some((tag, i) => tag !== b.tags[i])
  );
}

/** Map a normalized draft to the create payload. An empty category is omitted (the
 *  backend leaves it unset). The `note` marker that files it in the owner's `notes`
 *  bucket is added by `notesApi`, not here. */
export function toCreateBody(input: NoteInput): CreateNoteBody {
  const body: CreateNoteBody = { content: input.content };
  if (input.category) body.category = input.category;
  if (input.tags.length) body.tags = input.tags;
  return body;
}

/** Map a normalized draft to the update payload. A blank category is sent as `null` to
 *  CLEAR it (the backend distinguishes null = clear from omitted = unchanged); we always
 *  send the full draft, so blank means clear here. */
export function toUpdateBody(input: NoteInput): UpdateNoteBody {
  return {
    content: input.content,
    category: input.category || null,
    tags: input.tags,
  };
}

// The rail's scope and the fold that combines it with the button bar's filter now live in
// @agentic-toolkit/categories/src/category-scope.ts — verbatim the same union and the same
// function body — because Task 8's research pane needs the identical fold and a second copy
// is the duplication this move exists to remove. Re-exported here so nothing that imports
// them from `note-model` has to change.
export {
  resolveListCategory,
  type CategoryScope,
  type ListCategoryQuery,
} from "@agentic-toolkit/categories";

/** Distinct, sorted tags present across a set of notes (for the filter dropdown). */
export function tagsOf(notes: { tags: string[] }[]): string[] {
  const set = new Set<string>();
  for (const note of notes) for (const tag of note.tags) set.add(tag);
  return [...set].sort((a, b) => a.localeCompare(b));
}
