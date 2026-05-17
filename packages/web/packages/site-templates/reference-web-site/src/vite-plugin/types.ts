import type { SiteConfig } from '../types'

export interface AdditionalDir {
  dir: string
  section: string
}

export interface ReferenceSitePluginOptions {
  config: SiteConfig
  contentDir: string
  additionalDirs?: AdditionalDir[]
  /**
   * Optional list of cross-reference prefixes (e.g. ["cookbook", "guide"]).
   * When set, backtick-enclosed identifiers like `cookbook.foo.bar` in markdown
   * are converted into links to entries with matching `domain` frontmatter.
   * Default: [] (no cross-reference linking).
   */
  crossReferencePrefixes?: string[]
  /**
   * When true (default), the plugin injects <title>, description, and og/twitter
   * tags into index.html via transformIndexHtml. Set to false when embedding
   * the package inside a host that owns its own document head (e.g. an examples
   * shell or another site's subroute).
   */
  injectMeta?: boolean
}
