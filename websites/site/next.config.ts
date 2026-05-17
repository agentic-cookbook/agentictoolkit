import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'export',
  basePath: '/agentic-web-toolkit',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
}

export default config
