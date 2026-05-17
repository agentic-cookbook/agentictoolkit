/**
 * Languages we eagerly include in the bundled highlighter. Consumers can
 * pass anything Shiki supports — unknown languages are loaded lazily.
 */
export type DefaultLanguage =
  | 'ts'
  | 'tsx'
  | 'js'
  | 'jsx'
  | 'css'
  | 'json'
  | 'bash'
  | 'sh'
  | 'md'
  | 'html'
  | 'swift'
  | 'objective-c'
  | 'sql'

export type SourceCodePanelProps = {
  code: string
  /** Shiki language id. Defaults to `'tsx'`. Falls back to plain text on unknown. */
  lang?: string
  /**
   * Shiki theme name. When omitted, the panel reads `--scp-shiki-theme`
   * from the surrounding toolkit theme (set per `<ThemeStyle>` palette).
   * Falls back to `'github-dark'` if the var is unset.
   */
  theme?: string
  /** Show a copy-to-clipboard button in the panel header. */
  showCopy?: boolean
  /** Header label rendered above the code (filename, etc.). */
  filename?: string
  /** Extra class names on the root container. */
  className?: string
  /** Cap the visible height; long blocks scroll. */
  maxHeight?: number | string
}

export type UseSourceCodeArgs = {
  code: string
  lang?: string
  /** Shiki theme name (resolved by the caller from any source). */
  theme: string
}

export type UseSourceCodeResult = {
  /** Highlighted HTML, or `null` while loading. */
  html: string | null
  /** True until the highlighter and language grammar resolve. */
  loading: boolean
  /** Non-null if highlighting failed (unknown lang, load error). */
  error: Error | null
}
