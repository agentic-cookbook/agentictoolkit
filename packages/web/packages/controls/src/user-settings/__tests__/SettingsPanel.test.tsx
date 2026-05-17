import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel } from '../components/SettingsPanel'

function CompoundExample(props: { selectedId?: string; onSelect?: (id: string) => void; persistKey?: string }) {
  return (
    <SettingsPanel
      sidebarTitle="Settings"
      selectedId={props.selectedId}
      onSelect={props.onSelect}
      persistKey={props.persistKey}
    >
      <SettingsPanel.Sidebar />
      <SettingsPanel.Pane id="general" title="General">
        <div>general body</div>
      </SettingsPanel.Pane>
      <SettingsPanel.Pane id="notifications" title="Notifications" section="Preferences">
        <div>notifications body</div>
      </SettingsPanel.Pane>
      <SettingsPanel.Pane id="security" title="Security" section="Preferences" isDisabled>
        <div>security body</div>
      </SettingsPanel.Pane>
    </SettingsPanel>
  )
}

function resetStorage() {
  const ls = window.localStorage
  if (!ls) return
  for (let i = ls.length - 1; i >= 0; i--) {
    const k = ls.key(i)
    if (k) ls.removeItem(k)
  }
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    resetStorage()
  })

  it('selects the first enabled pane by default', () => {
    render(<CompoundExample />)
    expect(screen.getByText('general body')).toBeInTheDocument()
    expect(screen.queryByText('notifications body')).not.toBeInTheDocument()
  })

  it('switches pane when sidebar row is clicked', () => {
    render(<CompoundExample />)
    fireEvent.click(screen.getByRole('tab', { name: 'Notifications' }))
    expect(screen.getByText('notifications body')).toBeInTheDocument()
    expect(screen.queryByText('general body')).not.toBeInTheDocument()
  })

  it('groups panes by section, unsectioned first', () => {
    render(<CompoundExample />)
    const sidebar = screen.getByRole('navigation', { name: 'Settings sections' })
    const sectionTitles = sidebar.querySelectorAll('.aws-panel__sidebar-section-title')
    expect(sectionTitles).toHaveLength(1)
    expect(sectionTitles[0].textContent).toBe('Preferences')
    const rows = sidebar.querySelectorAll('.aws-panel__sidebar-row')
    expect(rows[0].textContent).toContain('General')
    expect(rows[1].textContent).toContain('Notifications')
    expect(rows[2].textContent).toContain('Security')
  })

  it('disables a pane and prevents selection', () => {
    render(<CompoundExample />)
    const securityRow = screen.getByRole('tab', { name: 'Security' })
    expect(securityRow).toBeDisabled()
    fireEvent.click(securityRow)
    expect(screen.queryByText('security body')).not.toBeInTheDocument()
  })

  it('respects controlled selectedId and calls onSelect on click', () => {
    const onSelect = vi.fn()
    render(<CompoundExample selectedId="notifications" onSelect={onSelect} />)
    expect(screen.getByText('notifications body')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'General' }))
    expect(onSelect).toHaveBeenCalledWith('general')
    // Still shows notifications since parent never updated.
    expect(screen.getByText('notifications body')).toBeInTheDocument()
  })

  it('persists selection to localStorage when persistKey is set', () => {
    const { unmount } = render(<CompoundExample persistKey="t1" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Notifications' }))
    expect(window.localStorage.getItem('aws-settings:t1')).toBe('notifications')
    unmount()
    render(<CompoundExample persistKey="t1" />)
    expect(screen.getByText('notifications body')).toBeInTheDocument()
  })

  it('renders panes via the data-driven API', () => {
    render(
      <SettingsPanel
        sidebarTitle="Account"
        panes={[
          { id: 'a', title: 'A', body: <div>body a</div> },
          { id: 'b', title: 'B', body: <div>body b</div> },
        ]}
      />,
    )
    expect(screen.getByText('body a')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'B' }))
    expect(screen.getByText('body b')).toBeInTheDocument()
  })

  it('uncontrolled mode tracks internal selection across clicks', () => {
    function Host() {
      const [, setHistory] = useState<string[]>([])
      return (
        <SettingsPanel onSelect={(id) => setHistory((h) => [...h, id])}>
          <SettingsPanel.Sidebar />
          <SettingsPanel.Pane id="x" title="X"><div>x body</div></SettingsPanel.Pane>
          <SettingsPanel.Pane id="y" title="Y"><div>y body</div></SettingsPanel.Pane>
        </SettingsPanel>
      )
    }
    render(<Host />)
    fireEvent.click(screen.getByRole('tab', { name: 'Y' }))
    expect(screen.getByText('y body')).toBeInTheDocument()
  })
})
