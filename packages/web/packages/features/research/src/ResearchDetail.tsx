"use client";

import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { CategoriesAndTags } from "@agentic-toolkit/ui/blocks/categories-and-tags";
import { MarkdownEditor } from "@agentic-toolkit/ui/blocks/markdown-editor";
import { MarkdownSpellCheck } from "@agentic-toolkit/ui/components/markdown-spellcheck";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import type { ResearchInput } from "./research-model";

/**
 * Controlled, fields-only research-document editor — the raw markdown body, plus the
 * category and tags that classify it. Save/Cancel/Delete live in the EditorSection toolbar
 * and publishing lives in its own section; this component only renders the draft and reports
 * edits.
 *
 * There is no Title field: the backend derives the title (an authored frontmatter title,
 * else the body's first line), so it is the same string in this editor, the list row, the
 * public paper index and the API. A field here could only disagree with them.
 *
 * Category and tags are the shared {@link CategoriesAndTags} block — still
 * `CategoryField` for the single value and `TagSetField` for the set, composed into the
 * two aligned rows every classification surface uses — so a document classifies exactly
 * the way a note does. This surface passes no category TREE: research reads its
 * categories as the distinct labels present across the user's documents, which is a
 * vocabulary, not a hierarchy, so the field renders its autocomplete/browse pair with no
 * breadcrumb.
 *
 * The card FILLS its pane: the body editor takes whatever height is left after the
 * classification rows, and scrolls inside itself. That is why every wrapper from the
 * Card down carries `min-h-0 flex-1` — one missing link in that chain and the editor
 * collapses to its content.
 */
export function ResearchDetail({
  draft,
  onChange,
  categoryOptions,
  tagOptions,
  error,
  disabled = false,
}: {
  draft: ResearchInput;
  onChange: (next: ResearchInput) => void;
  categoryOptions: string[];
  tagOptions: string[];
  error?: string | null;
  /** The document on screen is a CACHED copy and the server's answer has not landed yet. Every
   *  field goes read-only for that window: an edit made against a stale copy would be saved over
   *  whatever the server actually has, and the user would never know which one won. */
  disabled?: boolean;
}) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5">
        <MarkdownEditor
          fill
          label="Markdown body"
          placeholder={"# My research\n\nWrite or paste markdown here, or upload a .md file."}
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

        <CategoriesAndTags
          category={{
            // Plural, per Mike's drawing of this row — the caption names the vocabulary the
            // row draws from, not the arity of the value (which is still exactly one).
            label: "Categories",
            noun: "category",
            options: categoryOptions,
            value: draft.category,
            onChange: (category) => onChange({ ...draft, category }),
          }}
          tags={{
            label: "Tags",
            noun: "tag",
            options: tagOptions,
            value: draft.tags,
            onChange: (tags) => onChange({ ...draft, tags }),
          }}
          disabled={disabled}
        />

        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
