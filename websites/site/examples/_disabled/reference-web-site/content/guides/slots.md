---
title: Slots — the escape hatch
summary: Override Header, Footer, or specific routes when config isn't enough.
---

# Slots

When `SiteConfig` doesn't expose the field you need, fall back to slots.
They live on `config.slots`:

```ts
slots: {
  Header,         // replaces the default header chrome
  Footer,         // adds a footer
  extraRoutes,    // additional <Route> children
  routeOverrides: {
    '/changelog': MyCustomChangelogPage,
  },
}
```

Slots are an escape hatch, not the primary path. If a consumer reaches
for slots routinely, that's a sign `SiteConfig` is missing a field —
file an issue.
