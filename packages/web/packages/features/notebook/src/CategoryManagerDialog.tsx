"use client";

import { useMemo, useState } from "react";
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
import { Select } from "@agentic-toolkit/ui/components/select";
import { notesApi, taxonomyApi, type NoteCategory } from "@agentic-toolkit/data/notes";

import { buildCategoryTree, flattenCategoryTree, type CategoryNode } from "./category-tree";

/** Every id at or below `node` — the set a re-parent must not offer, since moving a category
 *  under its own descendant closes a loop the fold would then have to break (and the row
 *  would silently jump to the root). */
function subtreeIds(node: CategoryNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) for (const id of subtreeIds(child)) ids.add(id);
  return ids;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * The owner's whole category tree, editable in one place: rename, re-parent, retire, and add.
 *
 * It exists because the rail can only ever show the branch you are standing in, and the
 * per-note {@link CategoryField} can only rename the one category a note is filed under.
 * Neither can answer "what does my vocabulary look like, and is it still the shape I want".
 *
 * Three things about the writes are worth knowing at this call site:
 *
 *  - **Add goes through the MARKDOWN door** (`notesApi.createCategory`), not the generic CRUD
 *    one the other three use. Only that door resolves `?workspace=` to the owning principal,
 *    so a category added while looking at an ORG workspace belongs to the org rather than to
 *    whoever clicked Add. Rename/re-parent/delete address a row BY ID, which is already
 *    unambiguous, so they need no such resolution.
 *  - **Uniqueness is checked here.** A name is unique per owner across the whole tree, and the
 *    generic `PUT` takes no lock — so a rename onto an existing name would mint a duplicate and
 *    break every read that keys on the name (`?category=`, a note's own `category`, the
 *    autocomplete). The check is client-side because that is where the door is.
 *  - **Delete is a tombstone, and it is not local.** The category is retired everywhere it is
 *    used; notes filed under it come back Uncategorized, which is the rail row that exists for
 *    exactly this.
 */
export function CategoryManagerDialog({
  rows,
  onClose,
  onChanged,
  workspaceSlug,
}: {
  /** The owner's category rows, as the pane already has them. */
  rows: readonly NoteCategory[];
  onClose: () => void;
  /** Refetch the taxonomy (and anything keyed on it) after a write settles. */
  onChanged: () => void | Promise<void>;
  workspaceSlug?: string;
}) {
  // Pending name edits, keyed by id: the row shows the edit, the tree shows the truth. Cleared
  // per row on commit, so a refetch that lands mid-typing cannot yank the field.
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryNode | null>(null);

  const tree = useMemo(() => buildCategoryTree([...rows]), [rows]);
  const flat = useMemo(() => flattenCategoryTree(tree), [tree]);

  const nameOf = (node: CategoryNode): string => names[node.id] ?? node.name;

  /** The message to show instead of writing, or null when `next` is a usable new name. */
  function nameProblem(next: string, exceptId: string | null): string | null {
    const want = next.trim();
    if (want === "") return "A name is required.";
    if (want.length > 200) return "Name must be 200 characters or fewer.";
    const clash = rows.some(
      (row) => row.id !== exceptId && row.name.toLowerCase() === want.toLowerCase(),
    );
    return clash ? `There is already a category called “${want}”.` : null;
  }

  async function run(key: string, step: string, work: () => Promise<unknown>): Promise<boolean> {
    setBusy(key);
    setError(null);
    try {
      await work();
      await onChanged();
      return true;
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-categories", step });
      setError(errorText(err, "That change could not be saved."));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function commitRename(node: CategoryNode): Promise<void> {
    const next = nameOf(node).trim();
    if (next === node.name) {
      setNames((cur) => ({ ...cur, [node.id]: node.name }));
      return;
    }
    const problem = nameProblem(next, node.id);
    if (problem) {
      setError(problem);
      return;
    }
    const ok = await run(node.id, "rename", () => taxonomyApi.renameCategory(node.id, next));
    if (ok) setNames((cur) => ({ ...cur, [node.id]: next }));
  }

  async function commitReparent(node: CategoryNode, parentId: string): Promise<void> {
    await run(node.id, "reparent", () =>
      taxonomyApi.reparentCategory(node.id, parentId === "" ? null : parentId),
    );
  }

  async function commitAdd(): Promise<void> {
    const problem = nameProblem(newName, null);
    if (problem) {
      setError(problem);
      return;
    }
    const ok = await run("new", "create", () =>
      notesApi.createCategory(
        { name: newName.trim(), parentId: newParent === "" ? null : newParent },
        { workspace: workspaceSlug },
      ),
    );
    if (ok) {
      setNewName("");
      setNewParent("");
    }
  }

  async function confirmDelete(): Promise<void> {
    const node = pendingDelete;
    if (!node) return;
    const ok = await run(node.id, "delete", () => taxonomyApi.deleteCategory(node.id));
    if (ok) setPendingDelete(null);
  }

  const anyBusy = busy !== null;

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !anyBusy) onClose();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit categories</DialogTitle>
            <DialogDescription>
              Renaming or retiring a category changes it everywhere it is used. Notes under a
              retired category become uncategorized.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto">
            {flat.length === 0 ? (
              <p className="py-4 text-sm text-apt-text-muted">No categories yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {flat.map(({ node, depth }) => {
                  const forbidden = subtreeIds(node);
                  return (
                    <li
                      key={node.id}
                      className="flex items-center gap-2"
                      style={{ paddingLeft: depth * 16 }}
                    >
                      <Input
                        value={nameOf(node)}
                        aria-label={`Name of category ${node.name}`}
                        disabled={anyBusy}
                        className="flex-1"
                        onChange={(e) =>
                          setNames((cur) => ({ ...cur, [node.id]: e.target.value }))
                        }
                        onBlur={() => void commitRename(node)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void commitRename(node);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setNames((cur) => ({ ...cur, [node.id]: node.name }));
                          }
                        }}
                      />
                      <Select
                        aria-label={`Parent of category ${node.name}`}
                        value={node.parentId ?? ""}
                        disabled={anyBusy}
                        className="w-48"
                        onChange={(e) => void commitReparent(node, e.target.value)}
                      >
                        <option value="">No parent</option>
                        {flat
                          .filter((other) => !forbidden.has(other.node.id))
                          .map((other) => (
                            <option key={other.node.id} value={other.node.id}>
                              {"— ".repeat(other.depth)}
                              {other.node.name}
                            </option>
                          ))}
                      </Select>
                      <Button
                        variant="destructive-ghost"
                        size="icon-sm"
                        aria-label={`Delete category ${node.name}`}
                        disabled={anyBusy}
                        onClick={() => setPendingDelete(node)}
                      >
                        <Trash2 className="adh-button__icon" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-apt-border pt-3">
            <Input
              value={newName}
              aria-label="New category name"
              placeholder="e.g. Meetings"
              disabled={anyBusy}
              className="flex-1"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commitAdd();
                }
              }}
            />
            <Select
              aria-label="Parent of the new category"
              value={newParent}
              disabled={anyBusy}
              className="w-48"
              onChange={(e) => setNewParent(e.target.value)}
            >
              <option value="">No parent</option>
              {flat.map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {"— ".repeat(depth)}
                  {node.name}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              disabled={anyBusy || newName.trim() === ""}
              onClick={() => void commitAdd()}
            >
              Add
            </Button>
          </div>

          <ErrorText error={error} />
        </DialogContent>
      </Dialog>

      <AlertModal
        open={pendingDelete !== null}
        destructive
        title="Retire this category?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” stops being offered anywhere, and notes filed under it become uncategorized. Its subcategories are not retired — they move to the top level.`
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
