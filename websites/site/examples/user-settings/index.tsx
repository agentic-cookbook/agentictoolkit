'use client'

import { useState } from 'react'
import { ExamplePanel } from '../../src/ExamplePanel'
import {
  SettingsPanel,
  Group,
  Header,
  TextField,
  SecureTextField,
  Checkbox,
  Slider,
  Stepper,
  RadioGroup,
  Select,
  ChoiceSlider,
  ColorPicker,
  SettingsButton,
  Progress,
  Conditional,
  DismissibleHint,
  Explanation,
  Divider,
  VStack,
  HStack,
} from '@agentic-toolkit/controls/user-settings'
import '@agentic-toolkit/controls/user-settings/styles.css'

export const meta = { id: 'user-settings', label: 'User Settings' }

const GearIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M9.4 1.6l.5 1.7a5.5 5.5 0 0 1 1.6.7l1.6-.7 1.4 1.4-.7 1.6c.3.5.5 1 .7 1.6l1.7.5v2l-1.7.5a5.5 5.5 0 0 1-.7 1.6l.7 1.6-1.4 1.4-1.6-.7c-.5.3-1 .5-1.6.7l-.5 1.7h-2l-.5-1.7a5.5 5.5 0 0 1-1.6-.7l-1.6.7-1.4-1.4.7-1.6a5.5 5.5 0 0 1-.7-1.6l-1.7-.5v-2l1.7-.5c.2-.6.4-1.1.7-1.6l-.7-1.6 1.4-1.4 1.6.7c.5-.3 1-.5 1.6-.7l.5-1.7h2zM8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5z"/>
  </svg>
)
const BellIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M8 1a3 3 0 0 0-3 3v1.3a4 4 0 0 0-2 3.5V11l-1 2v1h12v-1l-1-2V8.8a4 4 0 0 0-2-3.5V4a3 3 0 0 0-3-3zM6.5 14.5a1.5 1.5 0 0 0 3 0h-3z"/>
  </svg>
)
const LockIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M5 6V4a3 3 0 0 1 6 0v2h1v9H4V6h1zm1 0h4V4a2 2 0 0 0-4 0v2z"/>
  </svg>
)
const SparkleIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1zm5 9l.7 2.3L16 13l-2.3.7L13 16l-.7-2.3L10 13l2.3-.7L13 10z"/>
  </svg>
)

function GeneralPane() {
  const [name, setName] = useState('Mike Fullerton')
  const [theme, setTheme] = useState('agenticcookbookweb')
  const [profilePublic, setProfilePublic] = useState(true)
  const [bio, setBio] = useState('')
  const [accent, setAccent] = useState('#c4a35a')
  const [size, setSize] = useState(14)

  return (
    <>
      <Group title="Profile" hint="How you appear across Agentic apps.">
        <TextField label="Display name" value={name} onChange={setName} />
        <Select
          label="Default theme"
          value={theme}
          onChange={setTheme}
          choices={[
            { value: 'agenticcookbookweb', label: 'Agentic Cookbook (default)' },
            { value: 'dev-team', label: 'Dev Team' },
            { value: 'terminal', label: 'Terminal' },
            { value: 'whimsical', label: 'Whimsical' },
          ]}
        />
        <Checkbox
          label="Make my profile public"
          value={profilePublic}
          onChange={setProfilePublic}
          hint="When off, only signed-in collaborators can see your profile."
        />
        <Conditional when={profilePublic}>
          <TextField
            label="Public bio"
            value={bio}
            onChange={setBio}
            multiline
            placeholder="Tell folks who you are."
          />
        </Conditional>
      </Group>

      <Group title="Appearance">
        <ColorPicker label="Accent color" value={accent} onChange={setAccent} />
        <Slider
          label="Body text size"
          value={size}
          onChange={setSize}
          min={11}
          max={20}
          step={1}
          caption={(v) => `${v}px`}
        />
      </Group>
    </>
  )
}

function NotificationsPane() {
  const [cadence, setCadence] = useState<'realtime' | 'daily' | 'weekly'>('daily')
  const [perDay, setPerDay] = useState(8)

  return (
    <>
      <DismissibleHint id="user-settings-demo:notifications-tip">
        Notifications fire when one of your watched personas posts a new message.
      </DismissibleHint>
      <Group title="Cadence">
        <RadioGroup
          label="How often"
          value={cadence}
          onChange={setCadence}
          choices={[
            { value: 'realtime', label: 'In realtime' },
            { value: 'daily', label: 'Daily digest', hint: 'Sent at 8am local time' },
            { value: 'weekly', label: 'Weekly digest' },
          ]}
        />
        <Stepper label="Max emails per day" value={perDay} onChange={setPerDay} min={0} max={50} />
      </Group>
    </>
  )
}

function ShowcasePane() {
  // One slice of state per primitive so every control is interactive.
  const [text, setText] = useState('Hello world')
  const [bio, setBio] = useState('Multiline\nwith\nnewlines.')
  const [secret, setSecret] = useState('s3cret-token')
  const [toggle, setToggle] = useState(true)
  const [checked, setChecked] = useState(false)
  const [volume, setVolume] = useState(40)
  const [count, setCount] = useState(3)
  const [pick, setPick] = useState<'a' | 'b' | 'c'>('b')
  const [theme, setTheme] = useState('terminal')
  const [trust, setTrust] = useState<'low' | 'med' | 'high'>('med')
  const [color, setColor] = useState('#7aa2f7')
  const [progress, setProgress] = useState(35)
  const [showDetail, setShowDetail] = useState(true)

  return (
    <>
      <DismissibleHint id="user-settings-demo:showcase-tip">
        This pane exercises every primitive in <code>@agentic-cookbook/agentic-web-toolkit/user-settings</code>.
      </DismissibleHint>

      <Header>Layout</Header>
      <Explanation>
        <code>Header</code>, <code>Group</code>, <code>Divider</code>, <code>Explanation</code>,{' '}
        <code>VStack</code>, and <code>HStack</code> are pure layout primitives — they don't
        carry state.
      </Explanation>
      <Group title="Stacks">
        <VStack gap={6}>
          <span>VStack item one</span>
          <span>VStack item two</span>
          <Divider />
          <HStack gap={8} align="center">
            <SettingsButton variant="primary">Primary</SettingsButton>
            <SettingsButton variant="secondary">Secondary</SettingsButton>
            <SettingsButton variant="destructive">Destructive</SettingsButton>
          </HStack>
        </VStack>
      </Group>

      <Header>Text input</Header>
      <Group title="TextField & SecureTextField">
        <TextField label="Single line" value={text} onChange={setText} placeholder="Type here" />
        <TextField
          label="Multiline"
          value={bio}
          onChange={setBio}
          multiline
          hint="Multiline maps to a textarea."
        />
        <SecureTextField
          label="Password / token"
          value={secret}
          onChange={setSecret}
          hint="Renders type=password."
        />
      </Group>

      <Header>Booleans</Header>
      <Group title="Checkbox appearances">
        <Checkbox
          label="Switch (default)"
          value={toggle}
          onChange={setToggle}
          hint="appearance=switch — renders as a role=switch toggle."
        />
        <Checkbox
          label="Plain checkbox"
          value={checked}
          onChange={setChecked}
          appearance="check"
          hint="appearance=check — native checkbox."
        />
      </Group>

      <Header>Numbers</Header>
      <Group title="Slider & Stepper">
        <Slider
          label="Volume"
          value={volume}
          onChange={setVolume}
          min={0}
          max={100}
          step={1}
          caption={(v) => `${v}%`}
        />
        <Stepper label="Count" value={count} onChange={setCount} min={0} max={10} />
      </Group>

      <Header>Choice</Header>
      <Group title="RadioGroup, Select, ChoiceSlider">
        <RadioGroup
          label="Radio"
          value={pick}
          onChange={setPick}
          choices={[
            { value: 'a', label: 'Option A' },
            { value: 'b', label: 'Option B', hint: 'with a hint line' },
            { value: 'c', label: 'Option C' },
          ]}
        />
        <Select
          label="Select"
          value={theme}
          onChange={setTheme}
          choices={[
            { value: 'terminal', label: 'Terminal' },
            { value: 'whimsical', label: 'Whimsical' },
            { value: 'dev-team', label: 'Dev Team' },
          ]}
        />
        <ChoiceSlider
          label="Snap to label"
          value={trust}
          onChange={setTrust}
          choices={[
            { value: 'low', label: 'Low' },
            { value: 'med', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
      </Group>

      <Header>Color & feedback</Header>
      <Group title="ColorPicker & Progress">
        <ColorPicker label="Accent" value={color} onChange={setColor} />
        <Slider
          label="Progress driver"
          value={progress}
          onChange={setProgress}
          min={0}
          max={100}
          caption={(v) => `${v}%`}
        />
        <Progress label="Determinate" value={progress} max={100} />
        <Progress label="Indeterminate" indeterminate hint="No value bound." />
      </Group>

      <Header>Conditional rendering</Header>
      <Group title="Conditional">
        <Checkbox label="Show extra detail" value={showDetail} onChange={setShowDetail} />
        <Conditional
          when={showDetail}
          fallback={<Explanation>Toggle the switch to reveal the detail field.</Explanation>}
        >
          <TextField
            label="Hidden when toggle is off"
            value={text}
            onChange={setText}
            hint="<Conditional when={...}> with optional fallback."
          />
        </Conditional>
      </Group>
    </>
  )
}

function SecurityPane() {
  const [token, setToken] = useState('')
  const [trust, setTrust] = useState<'low' | 'medium' | 'high'>('medium')

  return (
    <>
      <Group title="API access">
        <SecureTextField
          label="Personal access token"
          value={token}
          onChange={setToken}
          placeholder="Paste a token to test"
          hint="Tokens are stored on this device only in this demo."
        />
        <ChoiceSlider
          label="Trust level"
          value={trust}
          onChange={setTrust}
          choices={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
        <Progress label="Token strength" value={token.length * 10} max={100} />
      </Group>
      <Divider />
      <Group title="Danger" hint="These actions cannot be undone.">
        <Explanation>
          Deleting your account removes all personas, services, and tokens immediately.
        </Explanation>
        <HStack>
          <SettingsButton variant="destructive">Delete account</SettingsButton>
          <SettingsButton variant="secondary">Export data</SettingsButton>
        </HStack>
      </Group>
    </>
  )
}

export default function UserSettingsExample() {
  const [mode, setMode] = useState<'compound' | 'data'>('compound')
  const [selectedId, setSelectedId] = useState<string>('general')

  return (
    <ExamplePanel
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
          User Settings
        </h2>
        <p style={{ margin: 0, color: 'var(--color-text-secondary, var(--text-muted, #8a8a9a))', fontSize: '0.85rem' }}>
          Mirrors the macOS <code>ComposableSettingsWindow</code> pattern. Toggle between the
          compound API and the data-driven API below — both render through the same primitives.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
          <button
            onClick={() => setMode('compound')}
            style={tabButtonStyle(mode === 'compound')}
          >
            Compound API
          </button>
          <button
            onClick={() => setMode('data')}
            style={tabButtonStyle(mode === 'data')}
          >
            Data-driven API
          </button>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        {mode === 'compound' ? (
          <SettingsPanel
            sidebarTitle="Account"
            selectedId={selectedId}
            onSelect={setSelectedId}
            persistKey="user-settings-demo"
          >
            <SettingsPanel.Sidebar />
            <SettingsPanel.Pane id="general" title="General" icon={<GearIcon />}>
              <GeneralPane />
            </SettingsPanel.Pane>
            <SettingsPanel.Pane
              id="notifications"
              title="Notifications"
              icon={<BellIcon />}
              section="Preferences"
            >
              <NotificationsPane />
            </SettingsPanel.Pane>
            <SettingsPanel.Pane
              id="security"
              title="Security"
              icon={<LockIcon />}
              section="Preferences"
            >
              <SecurityPane />
            </SettingsPanel.Pane>
            <SettingsPanel.Pane
              id="showcase"
              title="All elements"
              icon={<SparkleIcon />}
              section="Reference"
            >
              <ShowcasePane />
            </SettingsPanel.Pane>
          </SettingsPanel>
        ) : (
          <SettingsPanel
            sidebarTitle="Account"
            selectedId={selectedId}
            onSelect={setSelectedId}
            panes={[
              { id: 'general', title: 'General', icon: <GearIcon />, body: <GeneralPane /> },
              {
                id: 'notifications',
                title: 'Notifications',
                icon: <BellIcon />,
                section: 'Preferences',
                body: <NotificationsPane />,
              },
              {
                id: 'security',
                title: 'Security',
                icon: <LockIcon />,
                section: 'Preferences',
                body: <SecurityPane />,
              },
              {
                id: 'showcase',
                title: 'All elements',
                icon: <SparkleIcon />,
                section: 'Reference',
                body: <ShowcasePane />,
              },
            ]}
          />
        )}
      </div>
    </ExamplePanel>
  )
}

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    font: 'inherit',
    fontSize: '0.8rem',
    padding: '0.3rem 0.75rem',
    background: active
      ? 'var(--color-accent-dim, var(--accent-dim, rgba(196,163,90,0.15)))'
      : 'transparent',
    color: 'inherit',
    border: '1px solid var(--color-border, var(--border, #2a2a36))',
    borderRadius: 4,
    cursor: 'pointer',
  }
}
