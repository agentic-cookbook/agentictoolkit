"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { Table2 } from "lucide-react";
import { useResourceList } from "@agentic-toolkit/data";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { CreateResourceDialog } from "@agentic-toolkit/resource";
import { schemasApi } from "@agentic-toolkit/data/markdown";
import { bucketsCacheKey } from "./schema-model";
import type { SchemaDefinition, SchemaDefinitionInput } from "./schema-model";
import { ButtonBar } from "@agentic-toolkit/resource";
import { RecordApiButton } from "@agentic-toolkit/api-explorer";
import { useMasterDetailForm } from "@agentic-toolkit/resource";
import { useMasterDetailLevel } from "@agentic-toolkit/resource";
import type { TopicLeaf } from "@agentic-toolkit/resource";
import {
  SchemaDefinitionDetail,
  schemaBlank,
  schemaToInput,
  schemaValidate,
} from "./SchemaDefinitionDetail";
import type { RenderTransferSection } from "../transfer-seam";

function schemaDiffers(a: SchemaDefinitionInput, b: SchemaDefinitionInput): boolean {
  // The input carries a `tables` array, so a deep compare is required rather
  // than per-field trimmed-string comparison.
  return JSON.stringify(a) !== JSON.stringify(b);
}

function schemaNormalize(d: SchemaDefinitionInput): SchemaDefinitionInput {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    tables: d.tables,
  };
}

export function SchemasPane({
  ecosystemId,
  help,
  leaf,
  renderTransfer,
}: {
  ecosystemId?: string;
  /** Unused: the breadcrumb names the pane now (kept for the ScopedPane prop shape). */
  title?: ReactNode;
  help?: ReactNode;
  /** Deep-linkable bucket selection (`…/schemas/<bucketId>`); omit for internal. */
  leaf?: TopicLeaf;
  /** The host's Transfer Ownership section for the open bucket — see
   *  {@link RenderTransferSection}. Omitted ⇒ no transfer is offered. */
  renderTransfer?: RenderTransferSection;
}) {
  // Creating a bucket is a MODAL over the stack, never a blank leaf (HTD recipe
  // `must-create-in-modal`): the `+` opens this, and on save the new bucket is
  // selected so its REAL detail (with the tables editor) opens.
  const [newOpen, setNewOpen] = useState(false);

  // Cached by ecosystem, so coming back to Buckets paints the rows it already had and revalidates
  // behind them. `useCallback` is load-bearing: the hook treats a NEW fetcher identity as "re-read",
  // so an inline closure here would re-fetch on every render.
  const load = useCallback(() => schemasApi.list(ecosystemId), [ecosystemId]);
  const {
    items: schemas,
    reload: refresh,
    error: loadError,
    isFetching,
  } = useResourceList<SchemaDefinition>(bucketsCacheKey(ecosystemId), load);

  const urlSelection = leaf
    ? { selectedId: leaf.leafId, onSelect: leaf.onSelect }
    : undefined;

  const form = useMasterDetailForm<SchemaDefinition, SchemaDefinitionInput>({
    items: schemas,
    getId: (s) => s.id,
    urlSelection,
    blank: schemaBlank,
    toInput: schemaToInput,
    validate: (draft, others) => schemaValidate(draft, others.map((o) => o.name)),
    differs: schemaDiffers,
    normalize: schemaNormalize,
    create: (input) => schemasApi.create(input, ecosystemId ?? ""),
    update: (id, input) => schemasApi.update(id, input),
    // The seeded `default` bucket (every ecosystem's "all tables") is built in — the backend 409s a
    // non-custom delete, so reject it up front with a clear message (like the Access pane's
    // undeletable "everyone" list) instead of surfacing a raw conflict.
    remove: (s) =>
      s.kind !== "custom"
        ? Promise.reject(new Error(`The “${s.name}” bucket is built in and can’t be deleted.`))
        : schemasApi.delete(s.id),
    confirmDelete: (s) =>
      `Delete bucket "${s.name}"? Applications that granted it will lose those tables.`,
    refresh,
    createLabel: "New bucket",
  });

  // PUBLISH the buckets list as a deeper stack level + register the editor's unsaved-work guard.
  useMasterDetailLevel({
    id: "buckets-list",
    title: "Buckets",
    form,
    items: schemas,
    getId: (s) => s.id,
    getLabel: (s) => s.name,
    getSublabel: (s) => `${s.tables.length} table${s.tables.length === 1 ? "" : "s"}`,
    itemIcon: <Table2 size={16} aria-hidden />,
    newLabel: "New bucket",
    leaf,
    // A failed read leaves `schemas` null forever, so "Loading…" alone would be a spinner that
    // never resolves in the rail while the error sits in the pane body. Same three-way as the
    // sibling Applications pane.
    emptyLabel: loadError
      ? "Couldn't load buckets."
      : schemas === null
        ? "Loading…"
        : "No buckets yet.",
    // The spinner before "Buckets" — the only thing that says a revalidation is running behind rows
    // the cache already put on screen. `emptyLabel` covers the FIRST read and nothing after.
    busy: isFetching,
    onNew: () => setNewOpen(true),
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ErrorText error={loadError} className="px-6 pt-4" />
      <ButtonBar
        actions={form.actions}
        showCreate={false}
        trailing={
          <RecordApiButton
            path="/bucket/buckets/{id}"
            pathValues={{ id: form.selectedId }}
            title="Bucket API"
          />
        }
        help={help}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        {form.editing && form.draft ? (
          <SchemaDefinitionDetail
            key={form.detailKey}
            title="Bucket"
            draft={form.draft}
            onChange={form.onChange}
            error={form.error}
            schema={form.selected}
            ecosystemRdid={ecosystemId}
            renderTransfer={renderTransfer}
          />
        ) : (
          <EmptyState
            title={schemas === null ? "Loading…" : "Select a bucket to edit, or create a new one."}
          />
        )}
      </div>

      {/* Create is a scoped modal: name + description only (the tables editor lives in the
          bucket's real detail, which opens once the created bucket is selected). */}
      {newOpen && (
        <CreateResourceDialog<SchemaDefinitionInput, SchemaDefinition>
          ariaLabel="New bucket"
          heading="New bucket"
          blank={schemaBlank}
          validate={(d) => schemaValidate(d, (schemas ?? []).map((s) => s.name))}
          create={(d) => schemasApi.create(schemaNormalize(d), ecosystemId ?? "")}
          onClose={() => setNewOpen(false)}
          onCreated={(bucket) => {
            setNewOpen(false);
            void refresh();
            if (leaf) leaf.onSelect(bucket.id);
            else form.select(bucket.id);
          }}
          renderForm={(draft, onChange, error) => (
            <>
              <Field label="Name" hint="Unique bucket name.">
                <Input
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
                  autoFocus
                  value={draft.name}
                  placeholder="Profile Basics"
                  onChange={(e) => onChange({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={2}
                  placeholder="What this bucket is for."
                  value={draft.description}
                  onChange={(e) => onChange({ ...draft, description: e.target.value })}
                />
              </Field>
              <ErrorText error={error} />
            </>
          )}
        />
      )}
    </div>
  );
}
