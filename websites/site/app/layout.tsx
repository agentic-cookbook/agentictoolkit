import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Shell } from './Shell'
import './globals.css'

export const metadata: Metadata = {
  title: 'Agentic Web Toolkit',
  description: 'Examples for the Agentic Web Toolkit component library.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  )
}
