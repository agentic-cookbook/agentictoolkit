import type { ReactNode } from 'react'

export type Accessor<T> = (item: T) => string | undefined | null

export type MatchFn<T> = (item: T, queryLower: string) => boolean

export interface FilteredListConfig<T> {
  items: readonly T[]
  /** Stable identity for React keys. */
  getId: (item: T) => string
  /** Primary label, also searched. */
  getTitle: Accessor<T>
  /** Secondary label, also searched. */
  getSubtitle?: Accessor<T>
  /** Tertiary content (e.g. URL, hint), also searched. */
  getDetails?: Accessor<T>
  /** Extra strings searched alongside title/subtitle/details. */
  getSearchableExtras?: (item: T) => readonly (string | undefined | null)[]
  /** Override the matcher. Receives the already-lowercased trimmed query. */
  match?: MatchFn<T>
  initialQuery?: string
}

export interface UseFilteredListResult<T> {
  query: string
  setQuery: (q: string) => void
  visible: readonly T[]
  total: number
  empty: boolean
}

export interface FilteredListProps<T> extends FilteredListConfig<T> {
  placeholder?: string
  className?: string
  autoFocus?: boolean
  /** Custom row rendering. Default lays out title / subtitle / details. */
  renderItem?: (item: T) => ReactNode
  /**
   * Fires when the user picks a row — by clicking, or by highlighting it
   * with arrow keys and pressing Enter.
   */
  onSelect?: (item: T) => void
  /**
   * Fires when the keyboard highlight moves between items, or returns to
   * `null` when the user types and clears the highlight.
   */
  onHighlightChange?: (item: T | null) => void
  /** Slot rendered after the list (e.g. "+ Custom service"). */
  footer?: ReactNode
  /** Replaces the default "no matches" message when the filter excludes everything. */
  emptyContent?: ReactNode
}
