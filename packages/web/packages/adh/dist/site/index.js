// src/site/SiteConfig.ts
var FAMILY_ROBOTS_DISALLOW = [
  "/login",
  "/signup",
  "/home",
  "/api/",
  "/auth/"
];
function defineSite(site) {
  return {
    id: site.id,
    seo: site.seo,
    robotsDisallow: site.robotsDisallow ?? FAMILY_ROBOTS_DISALLOW,
    sitemap: site.sitemap,
    shell: {
      siteId: site.id,
      header: site.header,
      providers: site.providers,
      navLinks: site.navLinks,
      trailingNavLinks: site.trailingNavLinks,
      footerLinks: site.footerLinks,
      silentSso: site.silentSso
    }
  };
}
async function siteSitemapRoutes(site) {
  return typeof site.sitemap === "function" ? site.sitemap() : site.sitemap;
}
export {
  FAMILY_ROBOTS_DISALLOW,
  defineSite,
  siteSitemapRoutes
};
//# sourceMappingURL=index.js.map