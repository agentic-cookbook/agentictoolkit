'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { themes } from '@agentic-toolkit/themes/manifest'

import { DEFAULT_ADH_THEME, DEFAULT_SITE_THEME } from './adh-themes'
import { switcherThemeKeys } from './theme-keys'
import { isSwitcherSeed, concatItemCss } from './resolve'
import { applyThemeCss, clearThemeOverride } from './theme-overrides'
import { applyBaseTheme, persistTheme, readStoredTheme } from './theme-preview'
import { reportUnexpectedError } from '@agentic-toolkit/adh/telemetry/report-error'
import {
  listThemes,
  createTheme,
  updateTheme,
  deleteTheme,
  type StoredTheme,
} from './themes-client'

// Mirrors the backend KEY_RE (routes/themes.ts) so the editor fails fast before a POST.
const KEY_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

export type ThemeSource = 'seed' | 'db'

/** A theme as the level-1 list sees it. */
export interface EditorTheme {
  key: string
  label: string
  basedOn: string | null
  source: ThemeSource
}

/** itemId → that item's free-form CSS block. */
export type CssMap = Record<string, string>

function seedThemes(): EditorTheme[] {
  return switcherThemeKeys().map((k) => ({
    key: k,
    label: themes[k].label,
    basedOn: null,
    source: 'seed',
  }))
}

/** The applied stylesheet: every item's block, concatenated (empties dropped). */
const concatCss = concatItemCss

/** Drop empty blocks so an untouched item never counts as a change / gets persisted. */
function clean(map: CssMap): CssMap {
  return Object.fromEntries(Object.entries(map).filter(([, v]) => v.trim()))
}

function mapsEqual(a: CssMap, b: CssMap): boolean {
  const ca = clean(a)
  const cb = clean(b)
  const ak = Object.keys(ca)
  return ak.length === Object.keys(cb).length && ak.every((k) => ca[k] === cb[k])
}

function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
}

const baseSeedOf = (t: { source: ThemeSource; key: string; basedOn: string | null }): string =>
  t.source === 'seed' ? t.key : isSwitcherSeed(t.basedOn) ? t.basedOn : DEFAULT_ADH_THEME

export interface ThemeEditorApi {
  loading: boolean
  error: string | null
  /** Seeds + saved DB themes + (while creating) the unsaved draft — the level-1 list. */
  themes: EditorTheme[]
  selectedKey: string | null
  isSeed: boolean
  isNew: boolean
  label: string
  themeKey: string
  basedOn: string | null
  dirty: boolean
  canSave: boolean
  canDelete: boolean
  saving: boolean
  /** The free-form CSS for an item (level 3). */
  itemCss: (itemId: string) => string
  select: (key: string | null) => void
  setItemCss: (itemId: string, css: string) => void
  setLabel: (label: string) => void
  setThemeKey: (key: string) => void
  newTheme: () => void
  /** Persist; resolves true on success, false if it failed (error set). */
  save: () => Promise<boolean>
  remove: () => Promise<void>
  cancel: () => void
  /** All item blocks concatenated — the full applied stylesheet (for export/copy). */
  exportCss: () => string
}

/**
 * All theme-editor state + behavior in one hook (SRP: the UI is pure presentation).
 * The unit of edit is now a FREE-FORM CSS block per item; a theme's `data` is the
 * map of those blocks. Seeds are read-only bases (preview only); DB themes are
 * editable. Editing applies live (base seed + concatenated blocks); Save persists.
 */
export function useThemeEditor(): ThemeEditorApi {
  const seeds = useMemo(seedThemes, [])
  const [dbRaw, setDbRaw] = useState<StoredTheme[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<CssMap>({})
  const [savedData, setSavedData] = useState<CssMap>({})
  const [label, setLabelState] = useState('')
  const [savedLabel, setSavedLabel] = useState('')
  const [themeKey, setThemeKeyState] = useState('')
  const [basedOn, setBasedOn] = useState<string | null>(null)
  const [isSeed, setIsSeed] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setDbRaw(await listThemes())
      setError(null)
    } catch (e) {
      reportUnexpectedError(e, { feature: 'theme-editor', step: 'load' })
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const allThemes = useMemo<EditorTheme[]>(() => {
    const list: EditorTheme[] = [
      ...seeds,
      ...dbRaw.map((t) => ({ key: t.key, label: t.label, basedOn: t.basedOn, source: 'db' as const })),
    ]
    if (isNew && selectedKey)
      list.push({ key: selectedKey, label, basedOn, source: 'db' })
    return list
  }, [seeds, dbRaw, isNew, selectedKey, label, basedOn])

  const applyLive = useCallback((data: CssMap, base: string) => {
    applyBaseTheme(base)
    applyThemeCss(concatCss(data))
  }, [])

  const select = useCallback(
    (key: string | null) => {
      if (key == null) {
        setSelectedKey(null)
        setDraft({})
        setSavedData({})
        setIsNew(false)
        setIsSeed(false)
        clearThemeOverride()
        return
      }
      const seed = seeds.find((s) => s.key === key)
      const db = dbRaw.find((t) => t.key === key)
      if (!seed && !db) return
      const data: CssMap = db ? { ...db.data } : {}
      const based = seed ? key : (db?.basedOn ?? null)
      setSelectedKey(key)
      setIsSeed(!!seed)
      setIsNew(false)
      setLabelState(db?.label ?? seed?.label ?? key)
      setSavedLabel(db?.label ?? seed?.label ?? key)
      setThemeKeyState(key)
      setBasedOn(based)
      setDraft(data)
      setSavedData({ ...data })
      applyLive(data, seed ? key : baseSeedOf({ source: 'db', key, basedOn: based }))
      persistTheme(key)
    },
    [seeds, dbRaw, applyLive],
  )

  // On open, focus the CURRENT (persisted) theme — fall back to the default. Runs
  // once, after the DB themes have loaded so a persisted DB theme resolves.
  const [autoSelected, setAutoSelected] = useState(false)
  useEffect(() => {
    if (autoSelected || loading) return
    setAutoSelected(true)
    const stored = readStoredTheme()
    // No stored choice → the page is showing the site default (the pre-paint applied it),
    // so focus THAT, not the base theme, or the editor opens pointed at a theme the
    // visitor isn't looking at.
    const key = stored && allThemes.some((t) => t.key === stored) ? stored : DEFAULT_SITE_THEME
    select(key)
  }, [autoSelected, loading, allThemes, select])

  // First edit of a built-in turns the selection into a NEW savable draft (a copy of
  // the seed) so editing immediately enables Save instead of being a dead-end preview.
  // Named + explicit (rather than buried in setItemCss) so the identity transition is
  // obvious; the original seed is untouched.
  const promoteSeedToDraft = useCallback(
    (seedKey: string, firstEdit: CssMap) => {
      const newKey = uniqueKey(`${seedKey}-custom`, new Set(allThemes.map((t) => t.key)))
      setSelectedKey(newKey)
      setThemeKeyState(newKey)
      setIsSeed(false)
      setIsNew(true)
      setBasedOn(seedKey)
      setLabelState((l) => `${l} copy`)
      setSavedLabel('')
      setSavedData({})
      setDraft(firstEdit)
      applyThemeCss(concatCss(firstEdit))
    },
    [allThemes],
  )

  const setItemCss = useCallback(
    (itemId: string, css: string) => {
      if (isSeed && selectedKey) {
        promoteSeedToDraft(selectedKey, { [itemId]: css })
        return
      }
      setDraft((prev) => {
        const next = { ...prev, [itemId]: css }
        applyThemeCss(concatCss(next))
        return next
      })
    },
    [isSeed, selectedKey, promoteSeedToDraft],
  )

  const newTheme = useCallback(() => {
    const taken = new Set(allThemes.map((t) => t.key))
    const key = uniqueKey('custom', taken)
    const based =
      (selectedKey ? allThemes.find((t) => t.key === selectedKey) : undefined)?.basedOn ??
      (isSwitcherSeed(selectedKey) ? selectedKey : DEFAULT_ADH_THEME)
    setSelectedKey(key)
    setIsSeed(false)
    setIsNew(true)
    setLabelState('New theme')
    setSavedLabel('')
    setThemeKeyState(key)
    setBasedOn(based)
    setDraft({})
    setSavedData({})
    applyLive({}, isSwitcherSeed(based) ? based : DEFAULT_ADH_THEME)
  }, [allThemes, selectedKey, applyLive])

  const dirty = useMemo(() => {
    if (isSeed) return false
    if (isNew) return Object.keys(clean(draft)).length > 0 || label.trim().length > 0
    return !mapsEqual(draft, savedData) || label !== savedLabel
  }, [isSeed, isNew, draft, savedData, label, savedLabel])

  const keyValid =
    KEY_RE.test(themeKey) && !allThemes.some((t) => t.key === themeKey && t.key !== selectedKey)
  // Dirty AND valid — nothing else. The busy/saving term is applied at each button that
  // consumes this (`SiteThemeBranch`'s footer renders `disabled={!ed.canSave || ed.saving}`),
  // so folding `!saving` in here would express the same rule twice — and that duplicate is
  // what previously stood in for the missing re-entrancy latch below.
  const canSave = !isSeed && dirty && label.trim().length > 0 && (!isNew || keyValid)
  const canDelete = !isSeed && !isNew && selectedKey != null

  // Re-entrancy latch. `saving` can't do this job: it is a RENDER value, so two activations
  // inside a single commit (a fast double-click on the footer's Save before React paints the
  // disabled button) both read the pre-save `false` and both POST — a create then 409s on its
  // own duplicate key. A ref flips synchronously on the way in and clears in `finally`.
  const savingRef = useRef(false)

  const save = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const data = clean(draft)
      if (isNew) {
        await createTheme({ key: themeKey, label: label.trim(), basedOn, data })
        await reload()
        setIsNew(false)
        setSavedData({ ...data })
        setSavedLabel(label.trim())
        setSelectedKey(themeKey)
      } else if (selectedKey) {
        await updateTheme(selectedKey, { label: label.trim(), basedOn, data })
        await reload()
        setSavedData({ ...data })
        setSavedLabel(label.trim())
      }
      return true
    } catch (e) {
      reportUnexpectedError(e, { feature: 'theme-editor', step: 'save' })
      setError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [draft, isNew, themeKey, label, basedOn, selectedKey, reload])

  const remove = useCallback(async () => {
    if (!selectedKey || isSeed || isNew) return
    setSaving(true)
    setError(null)
    try {
      await deleteTheme(selectedKey)
      await reload()
      select(null)
    } catch (e) {
      reportUnexpectedError(e, { feature: 'theme-editor', step: 'delete' })
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [selectedKey, isSeed, isNew, reload, select])

  const cancel = useCallback(() => {
    if (isNew) {
      select(null)
      return
    }
    setLabelState(savedLabel)
    setDraft({ ...savedData })
    applyThemeCss(concatCss(savedData))
  }, [isNew, savedLabel, savedData, select])

  const itemCss = useCallback((itemId: string) => draft[itemId] ?? '', [draft])
  const exportCss = useCallback(() => concatCss(draft), [draft])

  return {
    loading,
    error,
    themes: allThemes,
    selectedKey,
    isSeed,
    isNew,
    label,
    themeKey,
    basedOn,
    dirty,
    canSave,
    canDelete,
    saving,
    itemCss,
    select,
    setItemCss,
    setLabel: setLabelState,
    setThemeKey: setThemeKeyState,
    newTheme,
    save,
    remove,
    cancel,
    exportCss,
  }
}
