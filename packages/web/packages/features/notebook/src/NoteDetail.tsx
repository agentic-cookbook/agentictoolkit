"use client";

import { Card, CardContent } from "@agenticdevelopertoolkit/ui/components/card";
import {
  CategoryField,
  type CategoryTreeNode,
} from "@agenticdevelopertoolkit/ui/blocks/category-field";
import { TagSetField } from "@agenticdevelopertoolkit/ui/blocks/tag-set-field";
import { MarkdownDocumentEditor } from "@agenticdevelopertoolkit/markdown";
import { MarkdownSpellCheck } from "@agenticdevelopertoolkit/ui/components/markdown-spellcheck";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import type { NoteInput } from "./note-model";
import { NOTES_CORPUS, type CorpusNoun } from "./corpus";

/** What both surfaces below bind to. */
export interface NoteFieldsProps {
  draft: NoteInput;
  onChange: (next: NoteInput) => void;
  categoryOptions: string[];
  /** The owner's category tree, for the breadcrumb + the rename behind each crumb. Omitted
   *  (or empty) and the category renders as the single name it is. */
  categoryNodes?: CategoryTreeNode[];
  /** Rename a category from its crumb. Omit on a surface with no write access to the tree —
   *  the crumbs then render as static text. */
  onRenameCategory?: (
    node: CategoryTreeNode,
    nextName: string,
  ) => Promise<void>;
  tagOptions: string[];
  error?: string | null;
  /** The note on screen is a CACHED copy and the server's answer has not landed yet. Every field
   *  goes read-only for that window: an edit made against a stale copy would be saved over
   *  whatever the server actually has, and the user would never know which one won. Always false
   *  in the create modal, whose draft has no server copy to be stale against. */
  disabled?: boolean;
  /** WHICH SHELF these fields are filing into — the words only. Defaults to the owner's notes,
   *  so every existing caller reads exactly as it did. The FIELDS do not vary by corpus (a doc
   *  is a markdown document with a category and tags, same as a note); only the nouns do. */
  noun?: CorpusNoun;
}

/**
 * The note's three fields, unframed — the raw markdown body, then the category and tags that
 * file it, in that order.
 *
 * It is separate from {@link NoteDetail} so the CREATE modal and the editor are the same
 * component rather than two lists of fields that drift: a modal already has a surface of its
 * own, and nesting a `Card` inside one draws a box in a box. The frame is the only difference
 * between the two, so the frame is all that is duplicated.
 *
 * There is no Title field, and its absence is the feature: the title IS the document's first
 * line, derived by the backend so every client — this editor, the rail row, a device sync,
 * the API — shows the same one. A note is text; naming it twice is how the two names drift.
 *
 * The words come from the corpus (`noun`), so the same three fields read as a note's or a
 * document's without a second copy of them existing.
 *
 * Category and tags are both OPTIONAL, and both are shared blocks rather than fields
 * assembled here: {@link CategoryField} for the single hierarchical value (autocomplete +
 * browse + the breadcrumb saying where in the tree it sits) and {@link TagSetField} for the
 * set. The category field is what MOVES a note between categories — the rail beside it only
 * navigates.
 */
export function NoteFields({
  draft,
  onChange,
  categoryOptions,
  categoryNodes,
  onRenameCategory,
  tagOptions,
  error,
  disabled = false,
  noun = NOTES_CORPUS.noun,
}: NoteFieldsProps) {
  return (
    <div className="flex flex-col gap-5">
      <MarkdownDocumentEditor
        label={noun.One}
        placeholder={`My ${noun.one}\n\nThe first line is the ${noun.one}'s title.`}
        value={draft.content}
        onChange={(content) => onChange({ ...draft, content })}
        onUpload={(text) => onChange({ ...draft, content: text })}
        disabled={disabled}
        // Unbounded host (a plain flex column, no fixed height) — `fill` would collapse
        // the textarea to its intrinsic 2 rows instead of the fixed 16-row box below.
        fill={false}
        // Matches the textarea's own fixed-`rows` bulk (rows=16 default), so switching to
        // the Preview tab doesn't shrink the card and jump the Category/Tags fields below it.
        previewClassName="min-h-[20rem]"
        toolbarExtras={
          <MarkdownSpellCheck
            value={draft.content}
            onApply={(content) => onChange({ ...draft, content })}
            disabled={disabled}
          />
        }
      />

      <CategoryField
        label="Category"
        noun="category"
        hint={`Optional — where this ${noun.one} is filed. Type to autocomplete, or Choose to browse.`}
        options={categoryOptions}
        nodes={categoryNodes}
        value={draft.category}
        onChange={(category) => onChange({ ...draft, category })}
        onRename={onRenameCategory}
        disabled={disabled}
      />

      <TagSetField
        label="Tags"
        noun="tag"
        hint="Optional — a set of labels. Type to autocomplete, or Choose to browse."
        options={tagOptions}
        value={draft.tags}
        onChange={(tags) => onChange({ ...draft, tags })}
        disabled={disabled}
      />

      <ErrorText error={error} />
    </div>
  );
}

/** {@link NoteFields} in the editor's own card — what the master/detail leaf renders. */
export function NoteDetail(props: NoteFieldsProps) {
  return (
    <Card>
      <CardContent>
        <NoteFields {...props} />
      </CardContent>
    </Card>
  );
}
