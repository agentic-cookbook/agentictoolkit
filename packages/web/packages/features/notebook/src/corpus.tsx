import type { ReactNode } from "react";
import { FileText, NotebookPen } from "lucide-react";

import {
  notesApi,
  type Note,
  type NoteCategory,
  type NoteFilters,
  type NoteSummary,
  type NoteTag,
  type UpdateNoteBody,
} from "@agentic-toolkit/data/notes";
import { docsApi } from "@agentic-toolkit/data/docs";

/**
 * A CORPUS is which shelf of markdown documents this pane is standing in front of.
 *
 * The pane below it is one surface, not two: notes and docs are the same rows (a doc IS a
 * markdown document, exactly as a note is), the same editor, the same category DAG, the same
 * dirty/validity machinery, the same delete confirm. What differs is the marker the backend
 * files them under — `content.notes` vs `content.docs`, i.e. which storage bucket they land
 * in — and the words on screen. Both of those are data, so they are data here rather than a
 * second 600-line pane that starts identical and drifts. (dry, design-for-deletion)
 *
 * The corpora deliberately do NOT differ in taxonomy: one owner has ONE set of categories and
 * ONE set of tags, spanning notes, docs and research papers alike, so `categories`/`tagSet`
 * read the same vocabulary through whichever client they are reached by.
 */
export interface NotebookCorpus {
  /** The document client — `notesApi` or `docsApi`, each `markdownApi` with its own marker
   *  baked in. Typed structurally (see {@link CorpusApi}) so neither is privileged. */
  api: CorpusApi;
  /** Namespace for every cache key this pane writes: the list keys, the open-document key and
   *  the taxonomy keys. Distinct per corpus because the same document id can be cached under
   *  both and the LISTS are genuinely different sets. */
  cacheKey: string;
  /** `feature` on every `reportUnexpectedAuthError` — so a report says which surface raised it. */
  feature: string;
  /** The rail level's id. Spelled out rather than derived, because these ids are what hosts and
   *  tests address levels by; deriving them would make a rename here a silent break there. */
  levelId: string;
  /** `idPrefix` for the shared category levels above this one (`useCategoryLevels`). */
  idPrefix: string;
  /** The nouns every user-facing string in the pane is built from. */
  noun: CorpusNoun;
  /** The row icon, and the icon the rail draws beside each document. */
  icon: ReactNode;
}

/** Four spellings of the one noun, because the pane needs all four and inferring the capital
 *  or the plural from the other is how "Documentss" ships. */
export interface CorpusNoun {
  /** lowercase singular — "note", "document" */
  one: string;
  /** lowercase plural — "notes", "documents" */
  many: string;
  /** Capitalized singular — "Note", "Document" */
  One: string;
  /** Capitalized plural, and the rail level's title — "Notes", "Documents" */
  Many: string;
}

/** What the pane actually calls on a corpus client. Deliberately narrower than either client's
 *  full surface: it is the CONTRACT the pane depends on, so adding a method to one client does
 *  not quietly become something the pane may assume of the other. */
export interface CorpusApi {
  list(filters: NoteFilters, opts?: { workspace?: string }): Promise<NoteSummary[]>;
  get(id: string, opts?: { workspace?: string }): Promise<Note>;
  create(body: CorpusCreateBody, opts?: { workspace?: string }): Promise<Note>;
  update(id: string, body: UpdateNoteBody, opts?: { workspace?: string }): Promise<Note>;
  remove(id: string, opts?: { workspace?: string }): Promise<void>;
  categories(opts?: { workspace?: string }): Promise<NoteCategory[]>;
  tagSet(opts?: { workspace?: string }): Promise<NoteTag[]>;
}

/** The create body both clients accept — the three fields the editor writes. The marker flag
 *  (`note: true` / `doc: true`) is the CLIENT's to add and appears nowhere here, which is what
 *  makes it impossible for this pane to file a document on the wrong shelf. */
export interface CorpusCreateBody {
  content: string;
  category?: string;
  tags?: string[];
}

/** The owner's NOTES — the default corpus, and what `NotebookPane` renders when a caller says
 *  nothing. Jotted things: no publishing, no upload, one bucket. */
export const NOTES_CORPUS: NotebookCorpus = {
  api: notesApi,
  cacheKey: "notes",
  feature: "notebook-pane",
  levelId: "notebook-notes",
  idPrefix: "notebook",
  noun: { one: "note", many: "notes", One: "Note", Many: "Notes" },
  icon: <NotebookPen />,
};

/** The owner's DOCS — the informal corpus: anything written down that is not a note and not
 *  composed enough to be a paper. Markdown today; from v2 an uploaded file of any type, which
 *  is why it has a bucket (and a marker table) of its own rather than being a view of notes. */
export const DOCS_CORPUS: NotebookCorpus = {
  api: docsApi,
  cacheKey: "docs",
  feature: "docs-pane",
  levelId: "docs-documents",
  idPrefix: "docs",
  noun: { one: "document", many: "documents", One: "Document", Many: "Documents" },
  icon: <FileText />,
};
