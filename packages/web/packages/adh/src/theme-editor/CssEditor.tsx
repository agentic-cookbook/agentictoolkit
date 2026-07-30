'use client'

import { useRef } from 'react'
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react'

import { Button } from '@agentic-toolkit/ui/components/button'

// A free-form CSS editor (Monaco) with CSS autocomplete, validation/lint, and a
// Format action — all from Monaco's built-in CSS language service, no extra deps.
// Client-only and mounted ONLY inside the lazy, env-gated theme editor, so Monaco
// never ships to production. Themed to sit on the suite's dark surface.
//
// v1 uses @monaco-editor/react's default loader (Monaco + workers fetched on first use),
// so nothing here imports `monaco-editor` by name — but it stays a direct dependency of
// this package because @monaco-editor/react 4.7 declares it as a peerDependency
// (`>= 0.25.0 < 1`). It is NOT speculative: dropping it leaves that peer unmet. That it
// also pre-positions a fully self-hosted/offline loader is a bonus, not the reason.
export function CssEditor({
  value,
  onChange,
  height = 280,
}: {
  value: string
  onChange: (value: string) => void
  height?: number | string
}) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  const beforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('adh-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      // Match --color-surface so the editor blends into the pane.
      colors: { 'editor.background': '#0c0c0f' },
    })
  }

  const onMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  const format = () => {
    void editorRef.current?.getAction('editor.action.formatDocument')?.run()
  }

  return (
    <div className="overflow-hidden rounded-lg border border-apt-border">
      <div className="flex items-center justify-between border-b border-apt-border bg-apt-bg px-2.5 py-1">
        <span className="font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
          CSS
        </span>
        <Button variant="ghost" size="sm" onClick={format} className="font-mono text-xs">
          Format
        </Button>
      </div>
      <Editor
        height={height}
        language="css"
        theme="adh-dark"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        beforeMount={beforeMount}
        onMount={onMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'off',
          folding: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
        }}
        loading={<div className="p-3 font-mono text-xs text-apt-text-dim">Loading editor…</div>}
      />
    </div>
  )
}
