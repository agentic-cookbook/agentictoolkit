'use client'

import { Switch } from '@agenticdevelopertoolkit/ui/components/switch'
import {
  useShowDebugFrames,
  setShowDebugFrames,
  useSlowAnimations,
  setSlowAnimations,
  useCascadeLog,
  setCascadeLog,
} from '@agenticdevelopertoolkit/ui/blocks'
import type { ReactNode } from 'react'
import type { EnvOverrideSurface } from './seams'

/** One switch row. Keeps the three below identical in shape rather than repeating the label markup. */
function DebugSwitch({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint: ReactNode
  checked: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="flex flex-col">
        <span className="text-sm text-apt-text">{label}</span>
        <span className="font-mono text-xs text-apt-text-dim">{hint}</span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
    </label>
  )
}

/**
 * The console's Settings topic: the host's simulated-environment switch plus the
 * toolkit's own debug view flags.
 *
 * `envOverride` is INJECTED ({@link EnvOverrideSurface}) rather than imported: the store
 * belongs to the host, whose env vocabulary this package must not learn, and whose module
 * is deliberately pinned to a single subscriber set across bundler copies. Reading it from
 * here would move that module across a package boundary and change which bundler inlines
 * it — see the comment on the host's own `envOverride` module.
 */
export function SettingsPanel({ envOverride }: { envOverride: EnvOverrideSurface }) {
  const { useEnvOverride, setEnvOverride } = envOverride
  const override = useEnvOverride()
  // These live in the toolkit — it owns the views they drive, so it owns the flags (see its
  // `debug-options`). This panel only flips them.
  const showFrames = useShowDebugFrames()
  const slowAnimations = useSlowAnimations()
  const cascadeLog = useCascadeLog()
  return (
    <div className="flex flex-col divide-y divide-apt-border overflow-auto">
      <DebugSwitch
        id="adh-env-sim-prod"
        label="Simulate production"
        hint="DEPLOYMENT_ENV = production"
        checked={override === 'production'}
        onChange={(on) => setEnvOverride(on ? 'production' : null)}
      />
      <DebugSwitch
        id="adh-debug-mouse-frames"
        label="Show Mouse Detection Frames"
        hint="red = auto-collapse · green = auto-disclose"
        checked={showFrames}
        onChange={setShowDebugFrames}
      />
      <DebugSwitch
        id="adh-debug-slow-anim"
        label="Slow down animations by 10x"
        hint="0.3s → 3s, so transitions can be watched"
        checked={slowAnimations}
        onChange={setSlowAnimations}
      />
      <DebugSwitch
        id="adh-debug-cascade-log"
        label="Log cascade interactions"
        hint={
          <>
            one console line per event — <code>copy(__hmdvLogDump())</code> grabs the whole trace
          </>
        }
        checked={cascadeLog}
        onChange={setCascadeLog}
      />
    </div>
  )
}
