import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { referenceSitePlugin } from 'agentic-web-toolkit/reference-web-site/vite'
import { siteConfig } from './site.config.tsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    referenceSitePlugin({
      config: siteConfig,
      contentDir: path.resolve(__dirname, './content'),
    }),
  ],
})
