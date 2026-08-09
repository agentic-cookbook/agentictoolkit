"use client";

import { useState, type ReactElement } from "react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Button } from "@agentic-toolkit/ui/components/button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { ListChooser } from "@agentic-toolkit/ui/components/list-chooser";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@agentic-toolkit/ui/components/dialog";
import { DialogActions } from "@agentic-toolkit/ui/components/dialog-actions";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { Input } from "@agentic-toolkit/ui/components/input";
import type { SavedViewsController } from "./useSavedViews";
import { DEFAULT_ITEM_WORDS, type ItemWords } from "./vocabulary";

/** The all-pass row. Carried as an ITEM, exactly as the assignee filter carries "Anyone": a
 *  chooser with no way back to "everything" is a trap. */
const ALL = "";

/**
 * The saved-view bar: pick a view, or name what you are looking at.
 *
 * It is one control plus what that control cannot say. The {@link ListChooser} is the whole
 * picker — the same typeahead the assignee filter uses — and `allowCreate` makes SAVING the same
 * gesture as choosing: type a name that matches no view and the board is stored under it. That is
 * why there is no "Save view…" button; a second affordance for the thing the field already does
 * would be two ways to reach one verb.
 *
 * The three buttons are all contextual and none of them is ever a surprise. `Save` appears only
 * once the applied view has actually drifted, next to the badge that says so — a Save button on a
 * view that matches what is stored is a button whose press does nothing. `Rename…` and `Delete`
 * appear only while a view is applied, because they are things you do TO a view and there is no
 * view to do them to otherwise.
 *
 * What the bar deliberately does NOT have is a private/shared toggle. A saved view here belongs
 * to the project and everyone who can read the project can open it — a view only its author can
 * see is a bookmark, and the address bar is already a better one.
 */
export function SavedViewBar({
  controller,
  words = DEFAULT_ITEM_WORDS,
}: {
  controller: SavedViewsController;
  /** What this board calls its cards — the all-pass row names them, and the delete confirmation
   *  promises none of them are destroyed, which is only reassuring in the board's own word. */
  words?: ItemWords;
}): ReactElement {
  const { views, applied, modified, busy, error, apply, create, save, rename, remove } = controller;
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const items = [
    { value: ALL, label: `All ${words.many}` },
    ...(views ?? []).map((v) => ({ value: v.id, label: v.name })),
  ];

  return (
    // A labelled group, the way `SearchFilterBar` below it is a `role="search"` landmark: the row
    // is one subject, and "Rename…"/"Delete" only say WHICH thing they act on by sitting in it.
    <div role="group" aria-label="Saved views" className="flex flex-wrap items-center gap-2">
      <ListChooser
        items={items}
        value={applied?.id ?? ALL}
        onChange={(value, { isNew }) => {
          if (isNew) void create(value);
          else apply(value === ALL ? null : value);
        }}
        ariaLabel="Saved view"
        inputLabel="Find a view, or name this one"
        placeholder="Type a name…"
        createLabel={(text) => `Save this view as “${text}”`}
        emptyLabel="No matching view"
        // Loading, the chooser would offer "All work items" and nothing else — which reads as a
        // project with no saved views rather than a list that has not arrived.
        disabled={busy || views === null}
        className="w-56"
      />

      {modified && (
        <>
          {/* Named rather than implied by an enabled Save: the drift is the fact, and the button
              is only what you can do about it. Someone who does not want to save still needs to
              know that what they are looking at is not what the name says. */}
          <Badge variant="accent">Modified</Badge>
          <Button type="button" size="sm" variant="secondary" onClick={() => void save()}>
            Save
          </Button>
        </>
      )}

      {applied && (
        <>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(true)}>
            Rename…
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDeleting(true)}>
            Delete
          </Button>
        </>
      )}

      <ErrorText error={error} />

      {renaming && applied && (
        <RenameViewDialog
          current={applied.name}
          busy={busy}
          onCancel={() => setRenaming(false)}
          onRename={async (name) => {
            if (await rename(name)) setRenaming(false);
          }}
        />
      )}

      {/* Deleting a view destroys a shared artefact — everyone on the project loses it — so it
          confirms, and says the one thing that makes it safe: the work is untouched. `destructive`
          carries the rest of the policy (red action, cancel-first focus, no Enter-to-confirm). */}
      <AlertModal
        open={deleting && applied !== null}
        title={applied ? `Delete “${applied.name}”?` : ""}
        description={`Everyone on this project loses the view. No ${words.many} are deleted — the board keeps showing exactly what it is showing now.`}
        destructive
        confirmLabel="Delete view"
        cancelLabel="Keep"
        busy={busy}
        onConfirm={() => {
          void remove().then(() => setDeleting(false));
        }}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

/** Rename in a modal rather than in place: the chooser's field means "find or save as", and
 *  overloading it a third time with "and sometimes rename the one you are on" would make what
 *  Enter does depend on state the user cannot see. */
function RenameViewDialog({
  current,
  busy,
  onCancel,
  onRename,
}: {
  current: string;
  busy: boolean;
  onCancel: () => void;
  onRename: (name: string) => void;
}): ReactElement {
  const [name, setName] = useState(current);
  const trimmed = name.trim();

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-apt-gold">Rename view</DialogTitle>
        </DialogHeader>

        <Field label="Name">
          <Input
            autoFocus
            value={name}
            maxLength={200}
            aria-label="View name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && trimmed !== "" && trimmed !== current) {
                e.preventDefault();
                onRename(trimmed);
              }
            }}
          />
        </Field>

        <DialogFooter>
          <DialogActions
            cancelLabel="Cancel"
            onCancel={onCancel}
            confirmLabel="Rename"
            onConfirm={() => onRename(trimmed)}
            busy={busy}
            // An unchanged name is a PUT that says nothing; an empty one the server would refuse.
            confirmDisabled={trimmed === "" || trimmed === current}
            // The field is the point of this dialog — focus belongs there, not on a button.
            focusOnMount={false}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
