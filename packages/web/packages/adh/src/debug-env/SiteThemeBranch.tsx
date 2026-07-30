'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Braces, Brush, Globe, Layers, Megaphone, Paintbrush, SwatchBook, Type } from 'lucide-react'

import type { TopicLevel, TopicDetailItem } from '@agentic-toolkit/ui/blocks'
import { Button } from '@agentic-toolkit/ui/components/button'
import { Input } from '@agentic-toolkit/ui/components/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@agentic-toolkit/ui/components/dialog'
import { useClipboard } from '@agentic-toolkit/ui/hooks/useClipboard'
import { useIsomorphicLayoutEffect } from '@agentic-toolkit/ui/hooks/useIsomorphicLayoutEffect'

import type { ThemeEditorApi } from '@agentic-toolkit/adh/themes'
import type { DebugThemeArea, DebugThemeItem, ThemeAreasSurface } from './seams'
import { usePersistedSelection } from './selection-store'

// What each theme-editor AREA is about, at a glance: the whole site (global), the type system,
// the marketing landing, or raw custom CSS. New areas fall back to the generic layers icon.
const AREA_ICONS: Record<string, ReactNode> = {
  global: <Globe />,
  type: <Type />,
  marketing: <Megaphone />,
  custom: <Braces />,
}

// The "Site theme" branch of the Debug console: turns the theme editor's state
// (useThemeEditor) into HierarchicalTopicDetail levels — Themes ▸ Areas ▸ Items —
// plus a CSS leaf. Theme actions are HTD-native rather than a window-top toolbar:
// "New theme" is the Themes list's `onNew` (the ＋ in its header), and Save / Cancel /
// Delete ride a contextual footer inside the selected theme's detail pane. All behavior
// lives in useThemeEditor; this hook is composition + a theme-boundary-only unsaved
// guard. The body spreads `levels` after its root level, drops `leaf` in as HTD
// children, renders `prompt`, and calls `guardLeave`/`requestFocus` for guarded
// transitions.

// What the user wants to switch TO while the current theme has unsaved changes: a
// theme focus (or "All"), or an arbitrary action (New theme, top-topic-away, close).
type Pending = { type: 'focus'; key: string | null } | { type: 'action'; run: () => void } | null

export function useSiteThemeBranch(ed: ThemeEditorApi, themeAreas: ThemeAreasSurface) {
  // The taxonomy and the CSS editor are INJECTED ({@link ThemeAreasSurface}): WHICH
  // surfaces are themeable, and what a live preview of each looks like, is the host's
  // vocabulary — this package owns only the drill-down that renders it.
  const { areas: THEME_AREAS } = themeAreas
  // Restored from the last time the Debug window was shown (see `selection-store`); the theme
  // itself needs nothing here — `useThemeEditor` already re-focuses the persisted/current theme
  // on open. The item is validated against the RESTORED area, so a stored pair that no longer
  // belongs together (the area moved, the item was renamed) comes back cleared rather than
  // pointing the Items rail at a row it doesn't have.
  const [areaId, setAreaId] = usePersistedSelection<string>(
    'site-theme.area',
    (id) => THEME_AREAS.some((a) => a.id === id),
    null,
  )
  const [itemId, setItemId] = usePersistedSelection<string>(
    'site-theme.item',
    (id) => (THEME_AREAS.find((a) => a.id === areaId)?.items ?? []).some((i) => i.id === id),
    null,
  )
  const [pending, setPending] = useState<Pending>(null)

  const area = THEME_AREAS.find((a) => a.id === areaId) ?? null
  const item = area?.items.find((i) => i.id === itemId) ?? null

  // Guard only theme-boundary changes; area/item nav within the same draft loses
  // nothing, so it stays free (never routed through here or HTD's exitGuard).
  const guardLeave = (run: () => void) => {
    if (ed.dirty) setPending({ type: 'action', run })
    else run()
  }
  const requestFocus = (key: string | null) => {
    if (ed.dirty && key !== ed.selectedKey) setPending({ type: 'focus', key })
    else {
      ed.select(key)
      setAreaId(null)
      setItemId(null)
    }
  }

  const themeItems: TopicDetailItem[] = ed.themes.map((t) => ({
    id: t.key,
    label: t.label,
    // Row icons carry the built-in/custom distinction now: a built-in (seed) theme is the shipped
    // swatch book, a custom theme is a brush of its own (no placeholder circles).
    icon: t.source === 'seed' ? <SwatchBook /> : <Paintbrush />,
    // Custom (db) themes keep their key as a dim second line to tell them apart; seed themes
    // are single-line now — the old "built-in" subtitle padded every row for no real signal.
    sublabel: t.source === 'seed' ? undefined : t.key,
  }))

  const levels: TopicLevel[] = [
    {
      id: 'themes',
      title: 'Themes',
      items: themeItems,
      selectedId: ed.selectedKey,
      onSelect: (key) => requestFocus(key),
      onClear: () => requestFocus(null),
      emptyLabel: 'No themes.',
      // "New theme" is the Themes list header's ＋ (guarded so a dirty draft prompts first),
      // gold-tinted while a fresh unsaved theme is in progress (nothing selected in the list).
      onNew: () => guardLeave(() => ed.newTheme()),
      newLabel: 'New theme',
      newActive: ed.isNew,
    },
  ]
  if (ed.selectedKey != null) {
    levels.push({
      id: 'areas',
      title: 'Areas',
      items: THEME_AREAS.map((a) => ({ id: a.id, label: a.label, icon: AREA_ICONS[a.id] ?? <Layers /> })),
      selectedId: areaId,
      onSelect: (id) => {
        setAreaId(id)
        const next = THEME_AREAS.find((a) => a.id === id)
        setItemId(next?.items[0]?.id ?? null) // land on the area's first item
      },
      onClear: () => {
        setAreaId(null)
        setItemId(null)
      },
    })
  }
  if (area) {
    levels.push({
      id: 'items',
      title: area.label,
      items: area.items.map((i) => ({ id: i.id, label: i.label, icon: <Brush /> })),
      selectedId: itemId,
      onSelect: (id) => setItemId(id),
      onClear: () => setItemId(null),
    })
  }

  // With a theme open, the sub-detail (theme meta, or an item's CSS editor) fills the pane above a
  // contextual action footer (Save / Cancel / Delete) — replacing the old window-top action bar.
  const leaf: ReactNode =
    ed.selectedKey != null ? (
      <div className="flex min-h-0 flex-1 flex-col">
        {area && item ? (
          <ItemCssDetail ed={ed} area={area} item={item} themeAreas={themeAreas} />
        ) : (
          <ThemeMetaDetail ed={ed} />
        )}
        <ThemeActionFooter ed={ed} />
      </div>
    ) : (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-apt-text-muted">
        Pick a theme to edit, or start a new one with ＋ above.
      </div>
    )

  const prompt: ReactNode = (
    <UnsavedPrompt
      open={pending !== null}
      saving={ed.saving}
      error={ed.error}
      onSave={async () => {
        if (await ed.save()) {
          applyPending(pending, ed, setAreaId, setItemId)
          setPending(null)
        }
      }}
      onDiscard={() => {
        ed.cancel()
        applyPending(pending, ed, setAreaId, setItemId)
        setPending(null)
      }}
      onCancel={() => setPending(null)}
    />
  )

  return { levels, leaf, requestFocus, guardLeave, prompt }
}

/** Contextual action footer for the open theme: Save / Cancel / Delete + a failed-save error line.
 *  Replaces the old window-top action bar — it rides the bottom of the theme detail pane, shown only
 *  while a theme is selected, so no button bar spans the console above the breadcrumbs. */
function ThemeActionFooter({ ed }: { ed: ThemeEditorApi }) {
  return (
    <div className="shrink-0 border-t border-apt-border">
      {/* Surface a failed save/remove (dup key, validation, network) — without this the user gets
          zero feedback when save()/remove() returns false. */}
      {ed.error && <p className="px-4 pt-1.5 font-mono text-xs text-apt-red">{ed.error}</p>}
      <div className="flex items-center justify-end gap-2 px-4 py-2">
        <Button
          size="sm"
          variant="destructive-ghost"
          onClick={() => void ed.remove()}
          disabled={!ed.canDelete}
        >
          Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={ed.cancel} disabled={!(ed.dirty || ed.isNew)}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void ed.save()} disabled={!ed.canSave || ed.saving}>
          {ed.saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

// Carry out a deferred theme-boundary change once the dirty draft is resolved (saved
// or discarded): a focus re-selects the theme and resets the area/item drill; an
// action just runs. Area/item state is reset here (not by the caller) so a focus lands
// on the new theme's landing detail.
function applyPending(
  pending: Pending,
  ed: ThemeEditorApi,
  setAreaId: (v: string | null) => void,
  setItemId: (v: string | null) => void,
) {
  if (!pending) return
  if (pending.type === 'focus') {
    ed.select(pending.key)
    setAreaId(null)
    setItemId(null)
  } else {
    pending.run()
  }
}

/** Theme-landing detail: label + (for new themes) key. Shown when a theme is selected but no area. */
function ThemeMetaDetail({ ed }: { ed: ThemeEditorApi }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-apt-text-muted">Theme label</span>
        <Input value={ed.label} disabled={ed.isSeed} onChange={(e) => ed.setLabel(e.target.value)} />
      </label>
      {ed.isNew && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-apt-text-muted">Key</span>
          <Input value={ed.themeKey} onChange={(e) => ed.setThemeKey(e.target.value)} />
        </label>
      )}
      <p className="text-sm text-apt-text-dim">Pick an area, then an item, to edit its CSS.</p>
    </div>
  )
}

/** Leaf: the live Example preview + the Monaco CSS editor for the selected item. */
function ItemCssDetail({
  ed,
  area,
  item,
  themeAreas,
}: {
  ed: ThemeEditorApi
  area: DebugThemeArea
  item: DebugThemeItem
  themeAreas: ThemeAreasSurface
}) {
  const { readItemCss, CssEditor } = themeAreas
  const Preview = item.Preview ?? area.Preview
  const exampleRef = useRef<HTMLDivElement>(null)
  const [prefill, setPrefill] = useState('')
  const saved = ed.itemCss(item.id)
  const value = saved || prefill
  const clip = useClipboard()

  // Prefill the box with the live-read current CSS after paint (WYSIWYG), only when
  // unedited. `item` is a stable reference from the THEME_AREAS constant, so this
  // re-runs on exactly an item swap or an edit clearing `saved`.
  useIsomorphicLayoutEffect(() => {
    if (saved) return
    const id = requestAnimationFrame(() => setPrefill(readItemCss(item.id, exampleRef.current)))
    return () => cancelAnimationFrame(id)
  }, [item, saved, readItemCss])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
      <div ref={exampleRef} className="rounded-md border border-apt-border">
        <Preview />
      </div>
      <div className="flex items-center justify-end">
        <Button size="sm" variant="ghost" onClick={() => void clip.copy(ed.exportCss())}>
          {clip.copied ? 'Copied' : 'Copy all CSS'}
        </Button>
      </div>
      <CssEditor value={value} onChange={(v) => ed.setItemCss(item.id, v)} />
    </div>
  )
}

/** 3-action Save / Discard / Cancel prompt (mirrors the theme editor's UnsavedPrompt). */
function UnsavedPrompt({
  open,
  saving,
  error,
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean
  saving: boolean
  error: string | null
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onCancel()}>
      <DialogContent showClose={!saving}>
        <DialogHeader>
          <DialogTitle>Unsaved theme changes</DialogTitle>
          <DialogDescription>Save them, discard them, or stay to keep editing.</DialogDescription>
        </DialogHeader>
        {/* A save attempted from the prompt can fail (dup key, validation, network); the
            prompt stays open, so the user must see why here. */}
        {error && <p className="font-mono text-xs text-apt-red">{error}</p>}
        <DialogFooter className="flex-row justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive-ghost" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
