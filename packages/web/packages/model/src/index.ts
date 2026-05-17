export type {
  SiteConfig,
  BrandingConfig,
  MetaConfig,
  HeroConfig,
  NavConfig,
  NavSectionConfig,
  ExternalLink,
  ThemeConfig,
  FeaturesConfig,
  SlotsConfig,
  HeaderSlotProps,
  SiteEntry,
  SiteFrontmatter,
  HeadingEntry,
  NavNode,
} from './types'

export { buildNavTree } from './lib/nav'
export { slugToBreadcrumbs, type BreadcrumbEntry } from './lib/breadcrumbs'
export { findBySlug, getBySection, getByDomain } from './lib/lookup'
export { createSearchIndex, type SearchIndex, type SearchResult } from './lib/search'

export { SiteConfigProvider, useSiteConfig } from './providers/SiteConfigProvider'
export { ContentProvider, useContent, type ContentValue } from './providers/ContentProvider'
export { LinkProvider, useLink, type LinkComponent, type LinkComponentProps } from './providers/LinkProvider'
export { RouteProvider, useCurrentRoute, type RouteValue } from './providers/RouteProvider'

export { useSearchState, type SearchState } from './hooks/useSearchState'
