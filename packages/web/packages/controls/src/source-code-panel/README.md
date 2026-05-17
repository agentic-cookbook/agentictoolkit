# `@agentic-cookbook/agentic-web-toolkit/source-code-panel`

A React panel that renders prettified source code with Shiki (the
TextMate-grammar engine VS Code uses). Thin wrapper — Shiki does the
heavy lifting, this package supplies the React glue, theme integration,
and chrome (filename header, copy button).

## Why a package

Toolkit examples and consumer apps both want a "show me this code"
block. Shiki produces beautiful output but loading themes / grammars
correctly takes a few decisions; centralising them here keeps consumers
to a one-liner.

## Usage

```tsx
import { SourceCodePanel } from '@agentic-cookbook/agentic-web-toolkit/source-code-panel'
import '@agentic-cookbook/agentic-web-toolkit/source-code-panel/styles/source-code-panel.css'

<SourceCodePanel
  filename="example.tsx"
  lang="tsx"
  code={`export function hello() {
  return 'world'
}`}
/>
```

## Props

- `code` (required) — string to highlight.
- `lang` — Shiki language id. Defaults to `'tsx'`. Common ids
  (`ts`, `tsx`, `js`, `jsx`, `css`, `json`, `bash`, `sh`, `md`, `html`,
  `swift`, `objective-c`, `sql`) are bundled; anything else loads on
  demand.
- `theme` — Shiki theme name. Optional. When omitted, the panel reads
  `--scp-shiki-theme` from the active toolkit theme (see "Theming"
  below) and falls back to `'github-dark'`.
- `filename` — optional header label.
- `showCopy` — toggle the Copy button. Default `true`.
- `maxHeight` — caps the visible code area; long blocks scroll.
- `className` — extra class names on the root.

## Headless

```tsx
import { useSourceCode } from '@agentic-cookbook/agentic-web-toolkit/source-code-panel'

const { html, loading, error } = useSourceCode({ code, lang: 'json', theme: 'github-dark' })
```

`html` is a complete `<pre>…</pre>` Shiki produced. Inject with
`dangerouslySetInnerHTML` or transform further. The hook does **not**
read CSS variables — the consumer is responsible for resolving the
theme name. Use the `<SourceCodePanel>` component if you want the
toolkit theme integration.

## Theming

The panel chrome (header, copy button, scroll background) uses the
toolkit's CSS custom properties — `--color-surface-raised`,
`--color-border`, `--color-accent`, etc. — with hardcoded fallbacks.

The Shiki theme that colours the tokens themselves follows the **active
global theme**. Each toolkit theme stylesheet declares one variable:

```css
:root {
  --scp-shiki-theme: 'github-dark';   /* or 'github-light', or any Shiki theme */
}
```

When `<ThemeStyle>` swaps the global theme, the panel observes the
mutation and re-highlights with the new Shiki theme. Override at any
container level by setting `--scp-shiki-theme` on a wrapper — useful
when you want a single dark code block inside an otherwise-light page.

For Shiki's full list of bundled themes (`github-dark-dimmed`,
`one-dark-pro`, `dracula`, `nord`, `vitesse-dark`, `vitesse-light`, …)
see [shiki.style/themes](https://shiki.style/themes).
