"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import { Button } from "@agentic-toolkit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@agentic-toolkit/ui/components/dialog";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Input } from "@agentic-toolkit/ui/components/input";
import { taxonomyApi, type NoteTag } from "@agentic-toolkit/data/notes";

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * The owner's tags, renameable and retireable in one place.
 *
 * **There is no Add here, and that is not an omission.** A tag is minted by typing it on a
 * note, which goes through the markdown classification write and therefore lands under the
 * WORKSPACE'S owning principal. The generic `POST /content/keywords` this dialog would
 * otherwise use stamps the CALLER's principal instead — `content.keywords` has no
 * owner_kind/owner_id columns, so `?workspace=` cannot narrow it — and a tag created that way
 * while looking at an org workspace would belong to the person who clicked Add and never
 * appear in the org's vocabulary. Rename and delete address a row BY ID, so neither has the
 * problem. Minting a tag with no note on it is also not a thing the notebook needs: the
 * vocabulary is what the notes say it is.
 *
 * Rename propagates for free — `content.keyword_items` links by keyword id, never by text, so
 * every note wearing the tag follows. Delete is a tombstone; typing the same label again later
 * REVIVES that row and brings its old links back with it, because the label is unique per
 * owner and there is a row to revive into.
 */
export function TagManagerDialog({
  tags,
  onClose,
  onChanged,
}: {
  /** The owner's tags with their ids, as the pane already has them. */
  tags: readonly NoteTag[];
  onClose: () => void;
  /** Refetch the taxonomy (and anything keyed on it) after a write settles. */
  onChanged: () => void | Promise<void>;
}) {
  // Pending label edits, keyed by id — same reasoning as the category manager: the row shows
  // the edit, the fetched list shows the truth.
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NoteTag | null>(null);

  const labelOf = (tag: NoteTag): string => labels[tag.id] ?? tag.label;
  const anyBusy = busy !== null;

  async function run(key: string, step: string, work: () => Promise<unknown>): Promise<boolean> {
    setBusy(key);
    setError(null);
    try {
      await work();
      await onChanged();
      return true;
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-tags", step });
      setError(errorText(err, "That change could not be saved."));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function commitRename(tag: NoteTag): Promise<void> {
    const next = labelOf(tag).trim();
    if (next === tag.label) {
      setLabels((cur) => ({ ...cur, [tag.id]: tag.label }));
      return;
    }
    if (next === "") {
      setError("A tag needs a name.");
      return;
    }
    // A label is unique per owner and the generic PUT takes no lock, so renaming onto an
    // existing label would be a constraint violation at best and a duplicate at worst. Refuse
    // it here, where the user can still see what they typed.
    if (tags.some((t) => t.id !== tag.id && t.label.toLowerCase() === next.toLowerCase())) {
      setError(`There is already a tag called “${next}”.`);
      return;
    }
    const ok = await run(tag.id, "rename", () => taxonomyApi.renameTag(tag.id, next));
    if (ok) setLabels((cur) => ({ ...cur, [tag.id]: next }));
  }

  async function confirmDelete(): Promise<void> {
    const tag = pendingDelete;
    if (!tag) return;
    const ok = await run(tag.id, "delete", () => taxonomyApi.deleteTag(tag.id));
    if (ok) setPendingDelete(null);
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !anyBusy) onClose();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit tags</DialogTitle>
            <DialogDescription>
              Renaming or retiring a tag changes it on every note wearing it. New tags are made
              by typing them on a note.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto">
            {tags.length === 0 ? (
              <p className="py-4 text-sm text-apt-text-muted">No tags yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tags.map((tag) => (
                  <li key={tag.id} className="flex items-center gap-2">
                    <Input
                      value={labelOf(tag)}
                      aria-label={`Name of tag ${tag.label}`}
                      disabled={anyBusy}
                      className="flex-1"
                      onChange={(e) => setLabels((cur) => ({ ...cur, [tag.id]: e.target.value }))}
                      onBlur={() => void commitRename(tag)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void commitRename(tag);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setLabels((cur) => ({ ...cur, [tag.id]: tag.label }));
                        }
                      }}
                    />
                    <Button
                      variant="destructive-ghost"
                      size="icon-sm"
                      aria-label={`Delete tag ${tag.label}`}
                      disabled={anyBusy}
                      onClick={() => setPendingDelete(tag)}
                    >
                      <Trash2 className="adh-button__icon" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ErrorText error={error} />
        </DialogContent>
      </Dialog>

      <AlertModal
        open={pendingDelete !== null}
        destructive
        title="Retire this tag?"
        description={
          pendingDelete
            ? `“${pendingDelete.label}” comes off every note wearing it and stops being offered. Typing it again later brings it — and those notes — back.`
            : ""
        }
        confirmLabel="Retire"
        cancelLabel="Cancel"
        busy={anyBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!anyBusy) setPendingDelete(null);
        }}
      />
    </>
  );
}
