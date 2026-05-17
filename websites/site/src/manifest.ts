import type { ComponentType } from 'react'
import Chat from '../examples/chat'
import UserSettings from '../examples/user-settings'
import Theme from '../examples/theme'
import SiteModel from '../examples/site-model'
import Layout from '../examples/layout'
import Controls from '../examples/controls'
import Content from '../examples/content'
import FilteredList from './examples/filtered-list'
import SourceCodePanel from './examples/source-code-panel'
import LoggingPanel from './examples/logging-panel'
import OrbRow from './examples/orb-row'
import DevBanner from './examples/dev-banner'

export type ExampleEntry = {
  id: string
  label: string
  Component: ComponentType
}

export type ExampleGroup = {
  id: string
  label: string
  examples: ExampleEntry[]
}

export const groups: ExampleGroup[] = [
  {
    id: 'controls',
    label: 'Controls',
    examples: [
      { id: 'filtered-list',     label: 'Filtered List',     Component: FilteredList },
      { id: 'source-code-panel', label: 'Source Code Panel', Component: SourceCodePanel },
      { id: 'logging-panel',     label: 'Logging Panel',     Component: LoggingPanel },
      { id: 'orb-row',           label: 'Orb Row',           Component: OrbRow },
      { id: 'dev-banner',        label: 'Dev Banner',        Component: DevBanner },
      { id: 'user-settings',     label: 'User Settings',     Component: UserSettings },
      { id: 'controls',          label: 'Controls',          Component: Controls },
    ],
  },
  { id: 'layout',   label: 'Layout',   examples: [{ id: 'layout',     label: 'Layout',     Component: Layout }] },
  { id: 'content',  label: 'Content',  examples: [{ id: 'content',    label: 'Content',    Component: Content }] },
  { id: 'features', label: 'Features', examples: [{ id: 'chat',       label: 'Chat',       Component: Chat }] },
  { id: 'themes',   label: 'Themes',   examples: [{ id: 'theme',      label: 'Theme',      Component: Theme }] },
  { id: 'model',    label: 'Model',    examples: [{ id: 'site-model', label: 'Site Model', Component: SiteModel }] },
]

export const examples: ExampleEntry[] = groups.flatMap((g) => g.examples)
