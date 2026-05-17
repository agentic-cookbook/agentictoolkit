'use client'

import { useMemo } from 'react'
import { useContent } from '@agentic-web-toolkit/model'
import { useSiteConfig } from '@agentic-web-toolkit/model'
import { useCurrentRoute } from '@agentic-web-toolkit/model'
import { useSearchState } from '@agentic-web-toolkit/model'
import { SearchDialog, type SearchDialogProps } from './SearchDialog'

export type SearchDialogConnectedProps = Omit<
  SearchDialogProps,
  'state' | 'onSelect' | 'sectionLabels'
>

export function SearchDialogConnected(props: SearchDialogConnectedProps) {
  const { searchIndex } = useContent()
  const { nav } = useSiteConfig()
  const { navigate } = useCurrentRoute()
  const state = useSearchState(searchIndex)

  const sectionLabels = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of nav.sections) m[s.key] = s.label
    return m
  }, [nav.sections])

  return (
    <SearchDialog
      {...props}
      state={state}
      sectionLabels={sectionLabels}
      onSelect={(entry) => {
        navigate(entry.slug)
        props.onClose()
      }}
    />
  )
}
