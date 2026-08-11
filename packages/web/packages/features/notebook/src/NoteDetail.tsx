"use client";

import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { CategoryField, type CategoryTreeNode } from "@agentic-toolkit/ui/blocks/category-field";
import { TagSetField } from "@agentic-toolkit/ui/blocks/tag-set-field";
import { MarkdownEditor } from "@agentic-toolkit/ui/blocks/markdown-editor";
import { MarkdownSpellCheck } from "@agentic-toolkit/ui/components/markdown-spellcheck";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import type { NoteInput } from "./note-model";

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
  onRenameCategory?: (node: CategoryTreeNode, nextName: string) => Promise<void>;
  tagOptions: string[];
  error?: string | null;
  /** The note on screen is a CACHED copy and the server's answer has not landed yet. Every field
   *  goes read-only for that window: an edit made against a stale copy would be saved over
   *  whatever the server actually has, and the user would never know which one won. Always false
   *  in the create modal, whose draft has no server copy to be stale against. */
  disabled?: boolean;
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
 * There is no Title field, and its absence is the feature: the title IS the note's first
 * line, derived by the backend so every client — this editor, the rail row, a device sync,
 * the API — shows the same one. A note is text; naming it twice is how the two names drift.
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
}: NoteFieldsProps) {
  return (
    <div className="flex flex-col gap-5">
      <MarkdownEditor
        label="Note"
        placeholder={"My note\n\nThe first line is the note's title."}
        value={draft.content}
        onChange={(content) => onChange({ ...draft, content })}
        onUpload={(text) => onChange({ ...draft, content: text })}
        disabled={disabled}
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
        hint="Optional — where this note is filed. Type to autocomplete, or Choose to browse."
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
