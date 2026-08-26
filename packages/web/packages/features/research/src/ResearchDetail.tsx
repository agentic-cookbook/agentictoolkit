"use client";

import type { ReactNode } from "react";

import { MarkdownDocumentEditor } from "@agenticdevelopertoolkit/markdown";
import { Card, CardContent } from "@agenticdevelopertoolkit/ui/components/card";
import { CategoriesAndTags } from "@agenticdevelopertoolkit/ui/blocks/categories-and-tags";
import { MarkdownSpellCheck } from "@agenticdevelopertoolkit/ui/components/markdown-spellcheck";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import type { ResearchInput } from "./research-model";

/**
 * Controlled, fields-only research-document editor — the document's identity, its markdown
 * body (with a live preview and a side-by-side layout), and the category and tags that
 * classify it. Save/Cancel/Delete live in the leaf's button bar and publishing lives in the
 * pane's footer; this component only renders the draft and reports edits.
 *
 * The title is still DERIVED — the API accepts none, so every client shows the same string —
 * and the identity field above does not change that: it writes the frontmatter `title:` key
 * INSIDE the body, which is the one place an author may state a title. The field is passed in
 * as `identity` rather than built here because the slug half of it is the PANE's state (see
 * ResearchPane: a slug has nowhere to be persisted until the paper is published).
 *
 * This is the shared {@link MarkdownDocumentEditor} — the same editing view any document
 * surface gets. Nothing here imports its stylesheet: `@agenticdevelopertoolkit/markdown/styles` (and
 * the Tailwind @source registration it carries for the package's own components) already
 * reaches every family site through adh-family.css -> adh-help.css. A second import from
 * inside a tsup-built feature package would be a duplicate, not a safeguard.
 */
export function ResearchDetail({
  draft,
  identity,
  onChange,
  categoryOptions,
  tagOptions,
  error,
  disabled = false,
}: {
  draft: ResearchInput;
  /** The title/slug pair, rendered as the editor's header. */
  identity: ReactNode;
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
    // NO `min-h-0` on either box. They are the rest of the editor's chain (see
    // MarkdownDocumentEditor's root): waiving the content-based minimum here let a short pane
    // crush the card and the fields inside it painted over each other. `flex-1` without
    // `min-h-0` still fills a tall pane — it just refuses to go below what it holds, which the
    // pane's scroller (MasterDetailLeaf's content region) then absorbs.
    <Card className="flex flex-1 flex-col">
      <CardContent className="flex flex-1 flex-col gap-5">
        <MarkdownDocumentEditor
          fill
          header={identity}
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
