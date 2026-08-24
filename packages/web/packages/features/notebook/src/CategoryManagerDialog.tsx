"use client";

import { useMemo, useState } from "react";
import { Trash2, Unlink } from "lucide-react";

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

import {
  buildCategoryTree,
  categoryKey,
  flattenCategoryTree,
  type CategoryNode,
} from "@agentic-toolkit/ui/blocks";

/** parent id → the ids filed directly under it. Built once per row set; the reachability walk
 *  below runs per rendered row and would otherwise rebuild it every time. */
function childIndex(rows: readonly NoteCategory[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const row of rows) {
    for (const parentId of new Set(row.parentIds)) {
      const bucket = index.get(parentId);
      if (bucket) bucket.push(row.id);
      else index.set(parentId, [row.id]);
    }
  }
  return index;
}

/** `rootId` and everything reachable BELOW it — the categories it may not be filed under,
 *  since a category under its own descendant closes a loop. The backend refuses that edge
 *  (409); computing it here is what keeps the menu from offering the refusal in the first
 *  place. The seen-set bounds the walk, so an already-cyclic graph terminates. */
function reachableDown(index: Map<string, string[]>, rootId: string): Set<string> {
  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    for (const child of index.get(queue.shift() as string) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      queue.push(child);
    }
  }
  return seen;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * The owner's whole category hierarchy, editable in one place: rename, file, unfile, retire,
 * and add.
 *
 * It exists because the rail can only ever show the branch you are standing in, and the
 * per-note {@link CategoryField} can only rename the one category a note is filed under.
 * Neither can answer "what does my vocabulary look like, and is it still the shape I want".
 *
 * **A row here is a FILING, not a category.** The hierarchy is a DAG — a category may sit
 * under any number of parents — so one filed in two places is listed twice, once under each,
 * and each listing carries the unfile button for THAT link. Deduping the list would hide the
 * second filing behind a control the user then could not find; showing it twice is what makes
 * "it is in both places" a thing you can see and act on. The name input is the category's, so
 * editing either copy edits the one row behind them.
 *
 * Four things about the writes are worth knowing at this call site:
 *
 *  - **Add goes through the MARKDOWN door** (`notesApi.createCategory`), not the generic CRUD
 *    one the others use. Only that door resolves `?workspace=` to the owning principal, so a
 *    category added while looking at an ORG workspace belongs to the org rather than to
 *    whoever clicked Add. Rename/file/unfile/delete address a row BY ID, which is already
 *    unambiguous, so they need no such resolution.
 *  - **Filing is one edge per call.** `addCategoryParent` / `removeCategoryParent` each write
 *    one row, so every control here is a single request that either happened or did not —
 *    there is no half-applied set to reason about after a failure.
 *  - **Uniqueness is checked here.** A name is unique per owner across the whole hierarchy,
 *    and the generic `PUT` takes no lock — so a rename onto an existing name would mint a
 *    duplicate and break every read that keys on the name (`?category=`, a note's own
 *    `category`, the autocomplete). The check is client-side because that is where the door is.
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
  // Pending name edits, keyed by id: the row shows the edit, the hierarchy shows the truth.
  // Cleared per row on commit, so a refetch that lands mid-typing cannot yank the field.
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryNode | null>(null);

  const tree = useMemo(() => buildCategoryTree([...rows]), [rows]);
  const flat = useMemo(() => flattenCategoryTree(tree), [tree]);
  const index = useMemo(() => childIndex(rows), [rows]);
  // The option lists name CATEGORIES, so they take each one once — at the first depth it
  // appears at, which is the shallowest place the user has seen it.
  const choices = useMemo(() => {
    const seen = new Set<string>();
    return flat.filter(({ node }) => {
      if (seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    });
  }, [flat]);

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

  async function commitFile(node: CategoryNode, parentId: string): Promise<void> {
    if (parentId === "") return;
    await run(node.id, "file", () => taxonomyApi.addCategoryParent(node.id, parentId));
  }

  async function commitUnfile(node: CategoryNode, parentId: string): Promise<void> {
    await run(node.id, "unfile", () => taxonomyApi.removeCategoryParent(node.id, parentId));
  }

  async function commitAdd(): Promise<void> {
    const problem = nameProblem(newName, null);
    if (problem) {
      setError(problem);
      return;
    }
    const ok = await run("new", "create", () =>
      notesApi.createCategory(
        { name: newName.trim(), parentIds: newParent === "" ? [] : [newParent] },
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
              A category can sit under any number of others, so one filed in several places is
              listed once per place. Renaming or retiring a category changes it everywhere it is
              used; notes under a retired category become uncategorized.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto">
            {flat.length === 0 ? (
              <p className="py-4 text-sm text-apt-text-muted">No categories yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {flat.map(({ node, depth }) => {
                  // The parent THIS listing hangs from — the one its unfile button removes.
                  // A root listing has none, so it shows no button.
                  const under = node.path.length > 1 ? node.path[node.path.length - 2] : null;
                  const underName = under
                    ? (rows.find((row) => row.id === under)?.name ?? under)
                    : null;
                  const forbidden = reachableDown(index, node.id);
                  const already = new Set(node.parentIds);
                  return (
                    <li
                      key={categoryKey(node)}
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
                      {/* Always reads "File under…": it ADDS a place rather than replacing one,
                          and a select showing a current value would say the opposite. */}
                      <Select
                        aria-label={`File category ${node.name} under another`}
                        value=""
                        disabled={anyBusy}
                        className="w-48"
                        onChange={(e) => void commitFile(node, e.target.value)}
                      >
                        <option value="">File under…</option>
                        {choices
                          .filter(
                            (other) =>
                              !forbidden.has(other.node.id) && !already.has(other.node.id),
                          )
                          .map((other) => (
                            <option key={other.node.id} value={other.node.id}>
                              {"— ".repeat(other.depth)}
                              {other.node.name}
                            </option>
                          ))}
                      </Select>
                      {under && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Unfile category ${node.name} from ${underName}`}
                          title={`Unfile from ${underName}`}
                          disabled={anyBusy}
                          onClick={() => void commitUnfile(node, under)}
                        >
                          <Unlink className="adh-button__icon" />
                        </Button>
                      )}
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
            {/* One parent at mint, not a set: the second place a category belongs is a decision
                made once it exists, and it is one click away on its own row. */}
            <Select
              aria-label="Parent of the new category"
              value={newParent}
              disabled={anyBusy}
              className="w-48"
              onChange={(e) => setNewParent(e.target.value)}
            >
              <option value="">No parent</option>
              {choices.map(({ node, depth }) => (
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
            ? `“${pendingDelete.name}” stops being offered anywhere, and notes filed under it become uncategorized — the notes themselves are not deleted. Subcategories that are also filed elsewhere stay there; any filed nowhere else are retired along with it, and so are theirs.`
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
