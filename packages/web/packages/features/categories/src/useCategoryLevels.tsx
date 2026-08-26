"use client"

import * as React from "react"
import { Folder, Inbox, LayoutList } from "lucide-react"

import {
  buildCategoryTree,
  resolveCategoryChain,
  CategoryGearMenu,
  CategoryPickerDialog,
  CategoryRenameDialog,
  CategoryDeleteDialog,
  type CategoryGearAction,
  type CategoryNode,
  type CategoryTreeNode,
  type TopicDetailItem,
  type TopicLevel,
} from "@agenticdevelopertoolkit/ui/blocks"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@agenticdevelopertoolkit/ui/components/dialog"
import { DialogActions } from "@agenticdevelopertoolkit/ui/components/dialog-actions"
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text"
import { Input } from "@agenticdevelopertoolkit/ui/components/input"
import { taxonomyApi, markdownApi } from "@agentic-toolkit/data/markdown"

import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_SLUG,
  chainAfterDelete,
  chainAfterMove,
  chainAfterRename,
  scopeFor,
  type CategoryScope,
} from "./category-scope"

/** What the gear is acting on: which level opened it, and that level's selected node. */
interface GearTarget {
  /** The level's own category — `null` for the root list, whose "add" makes a root. */
  parent: CategoryNode | null
  /** The selected row, or `null` for no selection / a synthetic row. */
  node: CategoryNode | null
}

/** One open gear dialog: which action, on what. A fresh object per open, which is what lets
 *  {@link useCategoryLevels}'s write failure be tied to the dialog that caused it. */
interface PendingGear {
  action: CategoryGearAction
  target: GearTarget
}

export interface UseCategoryLevelsOptions {
  rows: readonly CategoryTreeNode[] | null
  error?: string | null
  chainSlugs: readonly string[]
  onSelectChain: (slugs: string[]) => void
  onChanged: () => void | Promise<void>
  itemNoun: string
  idPrefix: string
  workspaceSlug?: string
}

export interface UseCategoryLevelsResult {
  levels: TopicLevel[]
  scope: CategoryScope
  /** The resolved chain from root, for breadcrumbs and links. It is a SEPARATE field, not a
   *  member of `scope`: `scope` is the list query's input and travels into
   *  `resolveListCategory`, which narrows on `kind` and would be broken by an extra
   *  required member. */
  chain: CategoryNode[]
  /** Render this once, anywhere under the pane — it is the dialogs. */
  dialogs: React.ReactNode
}

/** Every descendant of `node` that is filed nowhere else — the three-line local walk of
 *  `node.children` that a Move dialog's `disabledIds` needs (a category can't be moved
 *  under itself or any of its own descendants). */
function descendantIds(node: CategoryNode): string[] {
  const ids: string[] = []
  for (const child of node.children) {
    ids.push(child.id, ...descendantIds(child))
  }
  return ids
}

/** A small local component: one `Input`, OK/Cancel, the same duplicate-name guard as a
 *  rename. NOT `CategoryRenameDialog` reused for create — a create and a rename look alike
 *  but say different things, and one component serving both would have to be told which
 *  sentence to print, which is the seam where it starts growing modes. Built from the same
 *  `Dialog`/`Input`/`DialogActions` primitives as `CategoryRenameDialog` (its closest
 *  sibling below), not hand-rolled markup — those primitives are what give it a focus trap,
 *  a portal, Escape-to-close and the shared `apt-*` styling that its three sibling dialogs
 *  in `dialogs` below already get for free. */
function AddCategoryDialog({
  open,
  parent,
  nodes,
  error,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  parent: CategoryNode | null
  nodes: readonly CategoryTreeNode[]
  error?: string | null
  busy?: boolean
  onCancel: () => void
  onConfirm: (name: string) => void
}): React.ReactElement {
  const [text, setText] = React.useState("")

  // A reopen is a fresh question. Resetting on `open` (rather than unmounting) keeps the
  // Dialog's own exit animation, which a remount would cut off — same as CategoryPickerDialog.
  React.useEffect(() => {
    if (open) setText("")
  }, [open])

  const trimmed = text.trim()
  const taken = nodes.some((n) => n.name.toLowerCase() === trimmed.toLowerCase())
  const title = parent ? `New category in “${parent.name}”` : "New category"

  function commit(): void {
    if (!trimmed || taken || busy) return
    onConfirm(trimmed)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={text}
          aria-label="Category name"
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter commits from the field itself — a one-input dialog where the user has to
            // reach for the button is a dialog that gets in the way. Escape is the Dialog's own.
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            }
          }}
        />
        {taken && trimmed ? (
          <ErrorText error={`A category named “${trimmed}” already exists.`} />
        ) : null}
        <ErrorText error={error} />
        <DialogActions
          confirmLabel="Create"
          onConfirm={commit}
          cancelLabel="Cancel"
          onCancel={onCancel}
          busy={busy}
          confirmDisabled={!trimmed || taken}
          // The input owns focus: this dialog is one field, and landing on a button would
          // send the first keystroke nowhere.
          focusOnMount={false}
        />
      </DialogContent>
    </Dialog>
  )
}

export function useCategoryLevels({
  rows,
  error = null,
  chainSlugs,
  onSelectChain,
  onChanged,
  itemNoun,
  idPrefix,
  workspaceSlug,
}: UseCategoryLevelsOptions): UseCategoryLevelsResult {
  // `rows` is fine as a dep bare: every caller on this branch sources it from
  // `useResourceList`'s `items` (react-query's `.data`), which react-query holds at a STABLE
  // identity across renders that don't land new data — the exact guarantee this memo needs,
  // and the same one `NotebookPane.tsx`'s own `useMemo(() => buildCategoryTree(categoryRows ??
  // []), [categoryRows])` already relies on today.
  const tree = React.useMemo(() => buildCategoryTree(rows ?? []), [rows])
  // Keyed on the JOINED slugs, NOT the array. `chainSlugs` is a prop callers build from a URL
  // parse, which hands back a fresh array every render — so the array itself is never a stable
  // dep, and keying on it directly would make `chain` (and `scope` below, which depends on it)
  // churn identity every render regardless of the memo. That identity reaches a consumer's
  // fetch key (see `NotebookPane.tsx:67`'s own comment on why a new fetcher identity is
  // `useResourceList`'s refetch signal), where churn means a refetch per render. `"".split("/")`
  // is `[""]`, not `[]`, so the empty chain is handled explicitly rather than left to
  // `resolveCategoryChain` to shrug off.
  const slugKey = chainSlugs.join("/")
  const chain = React.useMemo(
    () => resolveCategoryChain(tree, slugKey ? slugKey.split("/") : []),
    [tree, slugKey],
  )

  const [pending, setPending] = React.useState<PendingGear | null>(null)
  const [busy, setBusy] = React.useState(false)
  // The failure is stored WITH the dialog that caused it, and read back only while that same
  // dialog is still open. A bare `string | null` shared by four dialogs outlives the one that
  // set it: a failed delete that the user then cancels leaves the message sitting in state,
  // and the next dialog they open — an unrelated Add — renders "Could not delete" under its
  // name field, describing a write it never attempted. Clearing on every open would work too,
  // but only for as long as all six `setPending` call sites remember to; tying the message to
  // its owner makes the stale case unrepresentable instead of merely avoided. Identity, not
  // `action`: `setPending` builds a fresh object per open, so re-opening the SAME dialog on a
  // different category is a different owner and starts clean.
  const [failure, setFailure] = React.useState<{ owner: PendingGear; message: string } | null>(
    null,
  )
  const writeError = failure !== null && failure.owner === pending ? failure.message : null

  // ── The levels ─────────────────────────────────────────────────────────────
  // One per category DEPTH, exactly as deep as the tree the user has walked into. A LEAF
  // publishes nothing: an empty level takes no selection, and HTDV's frontier stops at the
  // first level with none — so an empty leaf level would hide the item list below it.
  const levels: TopicLevel[] = []
  {
    let siblings = tree
    let title = "Categories"
    let parent: CategoryNode | null = null
    for (let depth = 0; ; depth++) {
      const picked: CategoryNode | undefined = chain[depth]
      const ancestors = chainSlugs.slice(0, depth)
      const uncategorized = chainSlugs[0] === UNCATEGORIZED_SLUG
      const leadRows: TopicDetailItem[] =
        depth === 0
          ? [
              { id: ALL_CATEGORIES_ID, label: "All", icon: <LayoutList /> },
              {
                id: UNCATEGORIZED_SLUG,
                label: "Uncategorized",
                icon: <Inbox />,
                dividerAfter: true,
              },
            ]
          : []
      // The ROOT level is sorted by name; every level below it keeps the order it arrived in.
      // The root is the exception on purpose: it is the one level the spec constrains ("…
      // followed by the root categories sorted by name"), and it is the level with no context
      // to read an order from — a top-level list the user scans alphabetically is one they can
      // find a category in without knowing how it was entered. Deeper, the arriving order is
      // the OWNER's: `buildCategoryTree` documents that it preserves the backend's sibling
      // order (`sortOrder`, then name), and `CategoryPickerDialog` browses the same forest
      // without sorting — re-sorting here would make the rail and the picker disagree about
      // the same subtree in the same session, and would silently discard a drag-ordering the
      // owner set deliberately.
      const ordered = depth === 0 ? [...siblings].sort((a, b) => a.name.localeCompare(b.name)) : siblings
      const selectedId =
        picked?.slug ?? (depth > 0 ? null : uncategorized ? UNCATEGORIZED_SLUG : ALL_CATEGORIES_ID)
      const selectedNode = picked ?? null
      const levelParent = parent

      levels.push({
        id: `${idPrefix}-categories-${depth}`,
        title,
        items: [
          ...leadRows,
          // NO sublabel. The topic is the category's name and nothing else — a subcategory
          // count is a fact about the rail, not about the category, and it competed with the
          // name for the row.
          ...ordered.map((node): TopicDetailItem => ({
            id: node.slug,
            label: node.name,
            icon: <Folder />,
          })),
        ],
        selectedId,
        leadsTo: "list",
        itemNoun: "category",
        // The gear reads `selectedNode` and `levelParent` from THIS render's closure, both
        // recomputed above. That is the point: `rail-host.tsx`'s levelsKey ignores ReactNode
        // props, so anything the gear needs must also be reachable from a plain prop that
        // DOES change — `selectedId` here — or the level would never re-register and the
        // gear would act on a stale target after a rename.
        titleActions: (
          <CategoryGearMenu
            targetName={selectedNode?.name ?? null}
            canEditTarget={selectedNode !== null}
            onAction={(action) =>
              setPending({ action, target: { parent: levelParent, node: selectedNode } })
            }
          />
        ),
        onSelect: (slug) => {
          if (depth === 0 && slug === ALL_CATEGORIES_ID) return onSelectChain([])
          if (depth === 0 && slug === UNCATEGORIZED_SLUG) return onSelectChain([UNCATEGORIZED_SLUG])
          onSelectChain([...ancestors, slug])
        },
        onClear: () => onSelectChain([...ancestors]),
        emptyLabel:
          error ?? (rows === null ? "Loading…" : depth === 0 ? "No categories yet." : "No subcategories."),
      })

      if (!picked || picked.children.length === 0) break
      siblings = picked.children
      title = picked.name
      parent = picked
    }
  }

  // Same guard as `chain` above: keyed on `slugKey`, reconstructing the array from it inside
  // the memo body rather than closing over the unstable `chainSlugs` prop — so the dep array
  // stays honest (nothing read in the body is missing from it) as well as stable.
  const scope = React.useMemo(
    () => scopeFor(slugKey ? slugKey.split("/") : [], chain),
    [slugKey, chain],
  )

  /** Every descendant of `node` that is filed nowhere else — what the delete confirm names,
   *  and it must agree with the backend's cascade (crud/category-edges.ts). Computed from
   *  the same forest the rail draws, so the warning matches what the user is looking at. */
  function orphanedUnder(node: CategoryNode): string[] {
    const doomed = new Set<string>([node.id])
    const names: string[] = []
    let frontier = [node]
    while (frontier.length > 0) {
      const next: CategoryNode[] = []
      for (const parentNode of frontier) {
        for (const child of parentNode.children) {
          if (doomed.has(child.id)) continue
          const survives = child.parentIds.some((id) => !doomed.has(id))
          if (survives) continue
          doomed.add(child.id)
          names.push(child.name)
          next.push(child)
        }
      }
      frontier = next
    }
    return names
  }

  /**
   * One taxonomy write: perform it, refresh the tree, close the dialog that asked. THROWS if
   * the write fails, and leaves the dialog open when it does — `setPending(null)` is inside
   * the `try`, so a rejection never closes anything.
   *
   * The two dialog shapes here want opposite things from a failure, which is why this is
   * split from {@link run} rather than folded into it. The picker and the delete confirm are
   * fire-and-forget: they hand their answer over synchronously and never see a promise, so
   * the FAILURE has to surface out here, and it does — `run` catches it into `writeError`,
   * which those two render. `CategoryRenameDialog` is the other shape: it awaits its
   * `onRename` and documents that it "stays open, showing the reason, if it rejects", so it
   * needs the rejection to reach it. Routed through `run`, it never would — `run` resolves
   * either way, the dialog reads that as success, fires `onRenamed` and closes, and a rename
   * that never happened looks exactly like one that did. That is why it calls this directly.
   */
  async function perform(write: () => Promise<void>): Promise<void> {
    setBusy(true)
    try {
      await write()
      await onChanged()
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  /** {@link perform}, with the failure captured into `writeError` for the dialogs that show
   *  it themselves. Resolves either way — only a dialog that renders `writeError` may use
   *  this, because to any other caller a failure here is indistinguishable from a success. */
  async function run(write: () => Promise<void>): Promise<void> {
    // Captured BEFORE the await, from this render's closure: the dialog that asked. `perform`
    // leaves `pending` untouched on a rejection, so this is still the open dialog when the
    // message lands — and if the user closed it meanwhile, the message is simply never shown.
    const owner = pending
    setFailure(null)
    try {
      await perform(write)
    } catch (e) {
      const message = e instanceof Error ? e.message : "That did not work."
      if (owner) setFailure({ owner, message })
    }
  }

  const target = pending?.target

  /** Every parent the target is filed under APART from the one this level walked in through
   *  — the filings a move out of this level would leave standing. Empty is the ordinary
   *  single-filing case; non-empty is what makes the picker's root row a lie if it is left
   *  saying "Top level" (see `moveRootLabel`). */
  const otherFilings = React.useMemo(() => {
    const node = target?.node
    if (!node) return []
    const from = target?.parent?.id ?? null
    return node.parentIds.filter((id) => id !== from)
  }, [target])

  /** What the Move picker's "no parent" row actually DOES, said in the row.
   *
   *  Picking it removes the filing this level walked in through and adds nothing. When that
   *  was the category's only filing the result is a root, and "Top level" is exact. When it
   *  was not, the category stays filed wherever else it sits and does NOT become a root — so
   *  "Top level" would name an outcome that cannot happen, on the only control that expresses
   *  unfiling. The row is the same row either way; only its promise changes. */
  const moveRootLabel =
    otherFilings.length > 0 && target?.parent
      ? `Remove from “${target.parent.name}”`
      : "Top level"

  const dialogs = (
    <>
      {/* RENAME — the name only; every doc classified under it follows because the link
          points at the id. The ROUTE does not: selection identity is the slug, and the slug
          is derived from the name, so renaming the category the user is standing in expires
          the URL they are standing on. Re-selecting it under its new slug is what keeps the
          rename from reading as "you have been moved to All" — see `chainAfterRename`, which
          also decides when to leave the route alone. Inside the write callback, so it happens
          only when the rename actually landed, exactly as move and delete do below. */}
      <CategoryRenameDialog
        open={pending?.action === "rename"}
        node={target?.node ?? null}
        nodes={rows ?? []}
        noun="category"
        onRename={(_node, next) =>
          // `perform`, not `run`: this dialog owns its own error line and stays open on a
          // rejection, so the rejection has to reach it. See `perform`'s note.
          perform(async () => {
            // From the TARGET, not the dialog's argument: the dialog is typed on the flat
            // `CategoryTreeNode` it renders, and following the route needs the placed node
            // — the one that knows its path through the forest. Same object either way.
            const node = target?.node
            if (!node) return
            await taxonomyApi.renameCategory(node.id, next)
            const followed = chainAfterRename(chainSlugs, chain, tree, node, next)
            if (followed) onSelectChain(followed)
          })
        }
        onClose={() => setPending(null)}
      />

      {/* MOVE — re-file the category under a different parent. It rewrites the placement the
          user CAME IN THROUGH (the level's own parent), not every filing: a category under two
          parents stays under the other one, because moving it out of one place is not a claim
          about the other. `allowRoot` is what makes "move to top level" expressible. */}
      <CategoryPickerDialog
        open={pending?.action === "move"}
        nodes={rows ?? []}
        title={target?.node ? `Move “${target.node.name}”` : "Move category"}
        description="Choose where it should sit. Its other filings are left alone."
        confirmLabel="Move"
        allowRoot
        rootLabel={moveRootLabel}
        initialSelectedId={target?.parent?.id ?? null}
        disabledIds={target?.node ? [target.node.id, ...descendantIds(target.node)] : []}
        error={writeError}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(parentId) =>
          void run(async () => {
            const node = target?.node
            if (!node) return
            const from = target?.parent?.id ?? null
            if (parentId === from) return
            // Add BEFORE remove: if the add is refused (a cycle the snapshot did not show),
            // the category is still filed where it was rather than orphaned at top level.
            //
            // Two writes, no transaction — so the window between them is real and has to be
            // survivable rather than assumed away. `node.parentIds` is every parent the
            // category is filed under (including ones outside this forest), so an add that
            // ALREADY landed is skipped instead of re-issued: that is what makes a retry after
            // a half-applied move work at all, rather than failing forever on an edge that
            // exists.
            if (parentId !== null && !node.parentIds.includes(parentId)) {
              await taxonomyApi.addCategoryParent(node.id, parentId)
            }
            if (from !== null) {
              try {
                await taxonomyApi.removeCategoryParent(node.id, from)
              } catch (e) {
                // The add landed and the remove did not: the category is filed in BOTH places
                // now. `perform` skips its refresh on a rejection, so without this the rail
                // would keep drawing the PRE-move forest — the user is told the move failed
                // while looking at a tree that shows neither the new filing nor the truth.
                // Refresh first, then let the failure through: the message and the rail then
                // describe the same world, and the retry reads its `parentIds` from the
                // refreshed forest and skips the add above.
                // `onChanged` may return void, so it is awaited in its own try rather than
                // through `.catch` — and its failure must not replace the move's, which is
                // the one the user needs to read.
                try {
                  await onChanged()
                } catch {
                  /* the move's failure below is the one to report */
                }
                throw e
              }
            }
            // Follow the move, exactly as the rename above follows its new slug. A move keeps
            // every slug but re-parents the category, so the chain the user is standing on
            // stops resolving from this segment down — see `chainAfterMove`, which also
            // decides when to leave the route alone. Computed from the PRE-move forest
            // (`tree`/`chain` of this render), which is what tells us where the move landed.
            const followed = chainAfterMove(chainSlugs, chain, tree, node, parentId)
            if (followed) onSelectChain(followed)
          })
        }
      />

      {/* FILE — add ONE more place, and change nothing else. The verb the DAG has always
          supported and the rail could never say: `content.category_edges` has allowed a
          category any number of parents since 0203, but every gesture here rewrote a filing
          rather than adding one, so from this rail the hierarchy read as a tree. The only
          door that could add a filing was `CategoryManagerDialog`, which lives in the
          notebook feature and is unreachable from research.

          It is a SEPARATE verb rather than a mode on Move because the two differ in what they
          leave behind, which is exactly the thing a user has to be able to predict before
          confirming: Move takes the category out of here, File does not. A single dialog with
          a "keep the old one" checkbox would put that difference inside the dialog, after the
          user has already chosen — and the gear is where the choice belongs, since that is
          where the sentence is read.

          No `allowRoot`: a root is a category with NO parents, so "also file at the top
          level" names nothing. Removing the last filing is Move's root row, which now says
          so (see `moveRootLabel`).

          No navigation on success either, and that is not an omission. Filing adds a place
          without disturbing the one the user is standing in, so the route still resolves to
          exactly what it did before — the category is simply now reachable by a second path
          as well. Following the new filing would move the user away from the branch they were
          working in to prove a write they can already see in the rail. */}
      <CategoryPickerDialog
        open={pending?.action === "file"}
        nodes={rows ?? []}
        title={target?.node ? `Also file “${target.node.name}”` : "File category"}
        description="It stays where it is. Pick one more place to file it under."
        confirmLabel="File"
        initialSelectedId={null}
        disabledIds={
          target?.node
            ? [
                // Itself and its descendants close a CYCLE — the one rule the schema cannot
                // state, refused by migration 0204's trigger with a 409. Its existing parents
                // are refused too, by the edge's uniqueness. Both are shown greyed rather than
                // hidden: a category missing from the tree reads as "you may not have one
                // there", where a disabled row reads as "that one already", which is the truth
                // and the answer to the question the user was about to ask.
                target.node.id,
                ...descendantIds(target.node),
                ...target.node.parentIds,
              ]
            : []
        }
        error={writeError}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(parentId) =>
          void run(async () => {
            const node = target?.node
            // `null` cannot arrive — `allowRoot` is off, so the row that confirms it is not
            // rendered and Confirm stays disabled until a real category is picked. Narrowed
            // anyway rather than asserted: this is the branch where a future `allowRoot` would
            // silently unfile the category from everywhere instead of filing it.
            if (!node || parentId === null) return
            // ONE edge, one request — so there is no half-applied state to reason about the
            // way the two-write move has, and a retry after a failure is the same call again.
            await taxonomyApi.addCategoryParent(node.id, parentId)
          })
        }
      />

      <CategoryDeleteDialog
        open={pending?.action === "delete"}
        node={target?.node ?? null}
        orphanedNames={target?.node ? orphanedUnder(target.node) : []}
        itemNoun={itemNoun}
        error={writeError}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() =>
          void run(async () => {
            const node = target?.node
            if (!node) return
            await taxonomyApi.deleteCategory(node.id)
            // Leave the level that no longer exists — but only if the user is STANDING in it.
            // `slice(0, -1)` assumed the deleted category was always the last segment of the
            // route, which is only true when the gear was used on the deepest level. Deleting
            // a category the user has walked PAST would have dropped one segment off the far
            // end, moving them somewhere they never asked to go; deleting one they are not
            // inside at all would have moved them for no reason. `chainAfterDelete` finds the
            // deleted node in the chain and truncates THERE, and returns null — leave the
            // route alone — when it is not on the chain at all. Same shape as the rename and
            // move above, and computed from the PRE-delete forest for the same reason.
            const followed = chainAfterDelete(chainSlugs, chain, node)
            if (followed) onSelectChain(followed)
          })
        }
      />

      <AddCategoryDialog
        open={pending?.action === "add"}
        parent={target?.parent ?? null}
        nodes={rows ?? []}
        error={writeError}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(name) =>
          void run(async () => {
            await markdownApi.createCategory(
              { name, parentIds: target?.parent ? [target.parent.id] : [] },
              { workspace: workspaceSlug },
            )
          })
        }
      />
    </>
  )

  return { levels, scope, chain, dialogs }
}
