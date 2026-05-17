'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { SettingsPanelContext, useSettingsPanelContext } from '../context'
import type { SettingsPaneDescriptor, SettingsPaneEntry } from '../types'

type SettingsPanelOwnProps = {
  children?: ReactNode
  panes?: SettingsPaneEntry[]
  defaultPaneId?: string
  selectedId?: string
  onSelect?: (id: string) => void
  persistKey?: string
  className?: string
  sidebarTitle?: string
}

function readPersisted(persistKey: string | undefined): string | null {
  if (!persistKey || typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(`aws-settings:${persistKey}`)
  } catch {
    return null
  }
}

function writePersisted(persistKey: string | undefined, id: string): void {
  if (!persistKey || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`aws-settings:${persistKey}`, id)
  } catch {
    /* ignore quota / disabled storage */
  }
}

function SettingsPanelRoot(props: SettingsPanelOwnProps) {
  const {
    children,
    panes,
    defaultPaneId,
    selectedId: controlledSelectedId,
    onSelect,
    persistKey,
    className,
    sidebarTitle,
  } = props

  const [registered, setRegistered] = useState<SettingsPaneDescriptor[]>([])
  const [internalSelected, setInternalSelected] = useState<string | null>(() => {
    const persisted = readPersisted(persistKey)
    return persisted ?? defaultPaneId ?? null
  })

  const isControlled = controlledSelectedId !== undefined
  const selectedId = isControlled ? controlledSelectedId : internalSelected

  const registerPane = useCallback((descriptor: SettingsPaneDescriptor) => {
    setRegistered((prev) => {
      const filtered = prev.filter((p) => p.id !== descriptor.id)
      return [...filtered, descriptor]
    })
  }, [])

  const unregisterPane = useCallback((id: string) => {
    setRegistered((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const selectPane = useCallback(
    (id: string) => {
      if (!isControlled) setInternalSelected(id)
      onSelect?.(id)
      writePersisted(persistKey, id)
    },
    [isControlled, onSelect, persistKey],
  )

  const allPanes: SettingsPaneDescriptor[] = useMemo(() => {
    if (panes && panes.length > 0) {
      return panes.map(({ body: _body, ...descriptor }) => descriptor)
    }
    return registered
  }, [panes, registered])

  // Auto-select the first enabled pane when no selection or current selection is gone.
  const lastAutoSelectedRef = useRef<string | null>(null)
  useEffect(() => {
    if (allPanes.length === 0) return
    const currentExists =
      selectedId != null && allPanes.some((p) => p.id === selectedId && !p.isDisabled)
    if (currentExists) {
      lastAutoSelectedRef.current = null
      return
    }
    const first = allPanes.find((p) => !p.isDisabled)
    if (!first) return
    if (lastAutoSelectedRef.current === first.id) return
    lastAutoSelectedRef.current = first.id
    if (!isControlled) setInternalSelected(first.id)
    onSelect?.(first.id)
  }, [allPanes, selectedId, isControlled, onSelect])

  const ctx = useMemo(
    () => ({
      selectedId,
      selectPane,
      registerPane,
      unregisterPane,
      panes: allPanes,
      sidebarTitle,
    }),
    [selectedId, selectPane, registerPane, unregisterPane, allPanes, sidebarTitle],
  )

  const cls = ['aws-panel', className].filter(Boolean).join(' ')

  // Data-driven mode: render a default sidebar + body container alongside
  // the resolved selection. Children, if present, override.
  const dataMode = panes && panes.length > 0
  const selectedPane = dataMode
    ? panes.find((p) => p.id === selectedId) ?? null
    : null

  return (
    <SettingsPanelContext.Provider value={ctx}>
      <div className={cls}>
        {dataMode ? (
          <>
            <SettingsPanelSidebar />
            <div className="aws-panel__detail" role="tabpanel">
              {selectedPane?.body ?? null}
            </div>
          </>
        ) : (
          children
        )}
      </div>
    </SettingsPanelContext.Provider>
  )
}

function SettingsPanelSidebar({ title }: { title?: string }) {
  const { panes, selectedId, selectPane, sidebarTitle } = useSettingsPanelContext()
  const heading = title ?? sidebarTitle

  // Group panes by section, preserving insertion order. Unsectioned first.
  const groups = useMemo(() => {
    const map = new Map<string | null, SettingsPaneDescriptor[]>()
    for (const pane of panes) {
      const key = pane.section ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(pane)
    }
    // Move null group to the front.
    if (map.has(null)) {
      const ordered = new Map<string | null, SettingsPaneDescriptor[]>()
      ordered.set(null, map.get(null)!)
      for (const [k, v] of map) {
        if (k !== null) ordered.set(k, v)
      }
      return ordered
    }
    return map
  }, [panes])

  return (
    <nav className="aws-panel__sidebar" aria-label="Settings sections">
      {heading && <h2 className="aws-panel__sidebar-title">{heading}</h2>}
      {Array.from(groups.entries()).map(([section, items]) => (
        <div key={section ?? '__none__'} className="aws-panel__sidebar-section">
          {section && <div className="aws-panel__sidebar-section-title">{section}</div>}
          <ul className="aws-panel__sidebar-list" role="tablist">
            {items.map((pane) => {
              const selected = pane.id === selectedId
              const cls = [
                'aws-panel__sidebar-row',
                selected ? 'aws-panel__sidebar-row--selected' : '',
                pane.isDisabled ? 'aws-panel__sidebar-row--disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <li key={pane.id} role="presentation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`aws-pane-${pane.id}`}
                    disabled={pane.isDisabled}
                    className={cls}
                    onClick={() => !pane.isDisabled && selectPane(pane.id)}
                  >
                    {pane.icon && <span className="aws-panel__sidebar-icon">{pane.icon}</span>}
                    <span className="aws-panel__sidebar-label">{pane.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

type SettingsPanelPaneProps = SettingsPaneDescriptor & {
  children?: ReactNode
}

function SettingsPanelPane(props: SettingsPanelPaneProps) {
  const { id, title, icon, section, isDisabled, children } = props
  const { selectedId, registerPane, unregisterPane } = useSettingsPanelContext()

  useEffect(() => {
    registerPane({ id, title, icon, section, isDisabled })
    return () => unregisterPane(id)
  }, [id, title, icon, section, isDisabled, registerPane, unregisterPane])

  if (selectedId !== id) return null
  return (
    <div
      className="aws-panel__detail"
      role="tabpanel"
      id={`aws-pane-${id}`}
      aria-labelledby={`aws-pane-${id}-tab`}
    >
      {children}
    </div>
  )
}

export const SettingsPanel = Object.assign(SettingsPanelRoot, {
  Sidebar: SettingsPanelSidebar,
  Pane: SettingsPanelPane,
})

export type { SettingsPanelOwnProps as SettingsPanelProps }
