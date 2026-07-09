"use client";

import { useState } from "react";

import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Combobox } from "@agentic-toolkit/ui/components/combobox";
import { EntityChooser } from "@agentic-toolkit/ui/components/entity-chooser";
import { Field } from "@agentic-toolkit/ui/blocks/field";
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
 * a single value; tags are a multi-select set (the EntityChooser renders the chips).
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
  // Local text for the tag autocomplete. Selecting/typing an exact option commits it
  // to the set and clears the field; partial text just narrows the suggestions.
  const [tagText, setTagText] = useState("");

  // Tags not already chosen — the autocomplete never re-offers a selected tag.
  const tagSuggestions = tagOptions.filter((t) => !draft.tags.includes(t));

  function commitTag(value: string): void {
    if (draft.tags.includes(value)) return;
    onChange({ ...draft, tags: [...draft.tags, value] });
  }

  // Base UI's Autocomplete fires onValueChange with the full option string when a
  // suggestion is selected (click / Enter on a highlight); detect that exact match to
  // ADD the tag and reset, otherwise keep narrowing.
  function onTagInput(value: string): void {
    if (value && tagOptions.includes(value)) {
      commitTag(value);
      setTagText("");
    } else {
      setTagText(value);
    }
  }

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

        <Field label="Tags" hint="A set of labels. Type to autocomplete, or Choose to browse.">
          <div className="flex flex-col gap-2">
            <Combobox
              items={tagSuggestions}
              value={tagText}
              onValueChange={onTagInput}
              ariaLabel="Add a tag"
              placeholder="Add a tag…"
              className="w-full"
            />
            <EntityChooser
              multiple
              options={tagOptions}
              value={draft.tags}
              onChange={(tags) => onChange({ ...draft, tags })}
              ariaLabel="Tags"
              triggerLabel="Choose…"
              inputLabel="Filter or add a tag"
              placeholder="Filter or add a tag…"
              emptySelectionLabel="No tags yet"
            />
          </div>
        </Field>

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
