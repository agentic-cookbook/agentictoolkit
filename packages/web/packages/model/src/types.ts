import type { ComponentType, ReactNode } from 'react'

export interface SiteConfig {
  branding: BrandingConfig
  meta: MetaConfig
  hero: HeroConfig
  nav: NavConfig
  theme?: ThemeConfig
  features?: FeaturesConfig
  slots?: SlotsConfig
}

export interface BrandingConfig {
  title: string
  titleEmphasis?: string
  logoHref?: string
  githubUrl?: string
}

export interface MetaConfig {
  description: string
  siteUrl: string
  ogImage?: string
  twitterHandle?: string
}

export interface HeroConfig {
  heading: ReactNode
  body: ReactNode
  meta?: ReactNode
}

export interface NavConfig {
  sections: NavSectionConfig[]
  externalLinks?: ExternalLink[]
  sectionOrder?: string[]
}

export interface NavSectionConfig {
  key: string
  label: string
  description?: string
  path: string
  icon?: ReactNode
  fixedCount?: number
}

export interface ExternalLink {
  label: string
  href: string
  description?: string
  icon?: ReactNode
}

export interface ThemeConfig {
  defaultMode?: 'light' | 'dark' | 'auto'
}

export interface FeaturesConfig {
  search?: boolean
  toc?: boolean
}

export interface SlotsConfig {
  Home?: ComponentType
  Header?: ComponentType<HeaderSlotProps>
  Footer?: ComponentType
  extraRoutes?: ReactNode
  routeOverrides?: Record<string, ComponentType>
}

export interface HeaderSlotProps {
  onMenuToggle: () => void
  onSearchOpen: () => void
}

export interface SiteFrontmatter {
  title: string
  summary?: string
  type?: string
  modified?: string
  [key: string]: unknown
}

export interface SiteEntry<F extends SiteFrontmatter = SiteFrontmatter> {
  slug: string
  section: string
  subsection?: string | null
  domain?: string
  raw: string
  html: string
  headings: HeadingEntry[]
  frontmatter: F
}

export interface HeadingEntry {
  id: string
  text: string
  depth: number
}

export interface NavNode {
  label: string
  path: string
  domain?: string
  children: NavNode[]
}
