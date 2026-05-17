import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReferenceSite } from 'agentic-web-toolkit/reference-web-site'
import 'agentic-web-toolkit/reference-web-site/styles/tokens.css'
import 'agentic-web-toolkit/reference-web-site/styles/base.css'
import { siteConfig } from './site.config.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReferenceSite config={siteConfig} />
  </StrictMode>,
)
