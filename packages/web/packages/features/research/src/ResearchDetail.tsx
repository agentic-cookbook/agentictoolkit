"use client";

import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Combobox } from "@agentic-toolkit/ui/components/combobox";
import { EntityChooser } from "@agentic-toolkit/ui/components/entity-chooser";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { TagSetField } from "@agentic-toolkit/ui/blocks/tag-set-field";
import { MarkdownEditor } from "@agentic-toolkit/ui/blocks/markdown-editor";
import { MarkdownSpellCheck } from "@agentic-toolkit/ui/components/markdown-spellcheck";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import type { ResearchInput } from "./research-model";

// Strip a filename's extension for a derived title (e.g. "notes.md" → "notes").
function titleFromFilename(name: string): string {
  return name.replace(/\.(md|markdown|txt)$/i, "").trim();
}

/**
 * Controlled, fields-only research-document editor — title, category, tags, and
 * the raw markdown body. Save/Cancel/Delete live in the EditorSection toolbar and
 * publishing lives in its own section; this component only renders the draft and
 * reports edits. The markdown body is the shared `MarkdownEditor`; this component
 * owns the title/category/tags fields and the upload→title derivation.
 *
 * Category and tags both follow the `[Combobox autocomplete] [Choose…]` pattern:
 * the `Combobox` autocompletes from the account's existing categories/keywords
 * (`categoryOptions` / `tagOptions`, fetched from the backend), and the `Choose`
 * button (an `EntityChooser`) opens a browse/filter/select/add surface. Category is
 * a single value, assembled here; tags are the shared {@link TagSetField}, which owns
 * that whole arrangement for every surface that edits a label set (a work item's
 * labels is the same tagging system and now renders the same row).
 */
export function ResearchDetail({
  draft,
  onChange,
  categoryOptions,
  tagOptions,
  error,
}: {
  draft: ResearchInput;
  onChange: (next: ResearchInput) => void;
  categoryOptions: string[];
  tagOptions: string[];
  error?: string | null;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <Field label="Title" hint="Optional — derived from the document's heading if left blank.">
          <Input
            value={draft.title}
            placeholder="Untitled research"
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
          />
        </Field>

        <Field label="Category" hint="A single classification label. Type to autocomplete, or Choose to browse.">
          <div className="flex items-stretch gap-2">
            <Combobox
              items={categoryOptions}
              value={draft.category}
              onValueChange={(category) => onChange({ ...draft, category })}
              ariaLabel="Category"
              placeholder="e.g. architecture"
              className="flex-1"
            />
            <EntityChooser
              options={categoryOptions}
              value={draft.category || null}
              onChange={(next) => onChange({ ...draft, category: next ?? "" })}
              ariaLabel="Browse categories"
              triggerLabel="Choose…"
              inputLabel="Filter or add a category"
              placeholder="Filter or add a category…"
              className="w-44 shrink-0"
            />
          </div>
        </Field>

        <TagSetField
          label="Tags"
          noun="tag"
          hint="A set of labels. Type to autocomplete, or Choose to browse."
          options={tagOptions}
          value={draft.tags}
          onChange={(tags) => onChange({ ...draft, tags })}
        />

        <MarkdownEditor
          label="Markdown body"
          placeholder={"# My research\n\nWrite or paste markdown here, or upload a .md file."}
          value={draft.content}
          onChange={(content) => onChange({ ...draft, content })}
          onUpload={(text, fileName) =>
            onChange({
              ...draft,
              content: text,
              title: draft.title.trim() || titleFromFilename(fileName),
            })
          }
          toolbarExtras={
            <MarkdownSpellCheck
              value={draft.content}
              onApply={(content) => onChange({ ...draft, content })}
            />
          }
        />

        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
