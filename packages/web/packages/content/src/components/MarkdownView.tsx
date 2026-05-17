export type MarkdownViewProps = {
  html: string
  className?: string
}

export function MarkdownView({ html, className }: MarkdownViewProps) {
  const cls = ['awt-markdown', className].filter(Boolean).join(' ')
  return <div className={cls} dangerouslySetInnerHTML={{ __html: html }} />
}
