---
id: db6178e1-c613-4358-a0b4-8c6f5bfaaff9
title: UserCard
domain: agenticdeveloperhub://recipes/user-card
type: ingredient
version: 1.1.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "Renders a user's profile card from a backend DTO; privacy gating applied server-side, component renders whatever fields are present."
platforms:
  - typescript
  - web
tags:
  - component
  - user-card
  - profile
  - ui
depends-on: []
related: []
references: []
---

# UserCard

## Overview

`UserCard` is the shared profile card component used on the Agentic Developer
Hub public profile route (`/<slug>`) and in the profile-settings live preview.
It accepts a `UserCardDto` — a structural mirror of the backend's
`PublicUserProfile` schema — and renders whatever fields are present.

All privacy gating is enforced server-side before the DTO is produced. The
component never hides or filters fields on its own; it simply suppresses
empty sections (an empty array is an invisible section). This makes the same
component render correctly for both the public audience (PUBLIC card) and
authenticated hub members (HUB+PUBLIC card with more fields).

Two exports are provided: `UserCard` (the main card) and `UserCardSkeleton`
(a placeholder for the loading state).

## Behavioral Requirements

- **must-render-identity-header**: The component MUST always render the
  identity header (avatar, display name, @slug, member-since date) regardless
  of which optional sections are populated.
- **must-suppress-empty-sections**: Each of the five gated sections (Social,
  Email, Phone, Address, Personas) MUST be omitted from the DOM when its
  corresponding collection is empty.
- **must-show-separator-when-gated**: A `<Separator>` MUST appear between the
  identity header and the gated sections when at least one gated section is
  populated, and MUST be absent when all collections are empty.
- **must-link-social-externally**: Each social link MUST open in a new tab
  (`target="_blank" rel="noopener noreferrer"`) with the platform label and
  handle displayed.
- **must-show-initials-fallback**: When `avatarUrl` is null or the image fails
  to load, the `AvatarFallback` MUST show two-letter initials derived from
  `displayName`, falling back to the slug, falling back to a generic `UserIcon`.
- **must-use-displayname-or-slug**: The heading MUST display `displayName` when
  non-null, and `slug` otherwise; callers MUST NOT strip or transform the value.
- **must-label-article**: The `<article>` MUST carry `aria-label` of
  `"<displayName>'s profile"` (or `"<slug>'s profile"` when no display name).
- **must-not-filter-fields**: The component MUST NOT hide fields based on its
  own privacy logic; it renders only what the DTO provides.
- **must-accept-optional-classname**: The component MUST accept a `className`
  prop and apply it to the root `<article>`.
- **skeleton-must-declare-busy**: `UserCardSkeleton` MUST carry
  `role="status" aria-busy="true" aria-label="Loading profile…"` on its root
  element.

## Appearance

```
┌──────────────────────────────────────────────┐
│  [avatar]  Display Name                      │
│            @slug                             │
│            MEMBER SINCE <Month Year>         │
├──────────────────────────────────────────────┤  ← separator (only when gated content)
│  SOCIAL                                      │
│  ↗ Platform @handle   ↗ Platform @handle     │  ← wrapping flex row
├──────────────────────────────────────────────┤
│  EMAIL                                       │
│  ✉ email@example.com                         │
├──────────────────────────────────────────────┤
│  PHONE / ADDRESS / PERSONAS …               │
└──────────────────────────────────────────────┘
```

- Root: `rounded-xl border border-apt-border bg-apt-bg text-apt-text`.
- Avatar: `size-16` mobile, `size-20` sm+, with a fallback initials ring.
- Display name: `font-serif text-2xl` mobile, `text-3xl` sm+.
- Slug: `font-mono text-sm text-apt-text-muted`.
- Member since: `font-mono text-[0.7rem] uppercase tracking-[0.08em] text-apt-text-dim`.
- Section labels: `font-mono text-[0.6rem] uppercase tracking-[0.1em] text-apt-text-dim`.
- Social links: inline flex, `text-apt-text-muted hover:text-apt-text`, focus ring `apt-gold/40`.
- Persona items: `rounded-lg border border-apt-border bg-apt-surface p-3`; badge for `visibility`.

## States

| State | Appearance change |
|---|---|
| Loading | `UserCardSkeleton` — shimmer blocks replace all sections |
| Identity only | No separator, no gated sections; only the header area is shown |
| Full card | Separator + all populated gated sections visible |
| No avatar | `AvatarFallback` with two-letter initials or `UserIcon` placeholder |
| Long display name | Wraps inside the `min-w-0 flex-1` column; never truncated |

## Accessibility

- Root element is `<article>` with `aria-label="<displayName>'s profile"`.
  Screen readers announce this as a landmark.
- Social links are native `<a>` elements; `rel="noopener noreferrer"` is set for
  security; they do NOT carry additional `aria-label` because the visible text
  (platform + handle) is already descriptive.
- Email links use `mailto:` scheme; phone links use `tel:` scheme — native
  controls, no custom ARIA needed.
- Addresses use `<address>` element with `not-italic` (the browser default
  italic style for address is suppressed via CSS).
- `UserCardSkeleton` declares `role="status" aria-busy="true"` so assistive
  technologies announce the loading state.
- All lucide icon imports carry `aria-hidden="true"` since their meaning is
  conveyed by adjacent text.
- Focus ring for interactive elements: `focus-visible:ring-2 focus-visible:ring-apt-gold/40`.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-suppress-empty-sections, must-show-separator-when-gated | DTO with all empty collections | No separator, no section headings |
| T2 | must-show-separator-when-gated | DTO with one social link | Separator rendered between header and social section |
| T3 | must-link-social-externally | DTO with a GitHub link | `<a>` has `target="_blank"` + `rel="noopener noreferrer"`, displays "GitHub" + "@handle" |
| T4 | must-show-initials-fallback | `avatarUrl: null`, `displayName: "Ada Lovelace"` | AvatarFallback shows "AL" |
| T5 | must-show-initials-fallback | `avatarUrl: null`, `displayName: null`, `slug: "ada"` | AvatarFallback shows "A" (first char of slug, uppercased) |
| T6 | must-use-displayname-or-slug | `displayName: null`, `slug: "ada"` | Heading text is "ada" |
| T7 | must-label-article | `displayName: "Ada Lovelace"` | `<article aria-label="Ada Lovelace's profile">` |
| T8 | skeleton-must-declare-busy | render `UserCardSkeleton` | DOM has `role="status"`, `aria-busy="true"`, `aria-label="Loading profile…"` |
| T9 | must-accept-optional-classname | `className="my-custom"` | root `<article>` includes `my-custom` in classList |
| T10 | must-render-identity-header | any valid DTO | Identity header always rendered; slug always present |

## Edge Cases

- **Single-word display name**: `initialsOf("Alice")` returns "A" (one initial).
- **Slug with no spaces**: initials fallback uses the first character of the slug, uppercased.
- **Null displayName**: falls back to slug for the heading AND initials.
- **Avatar URL from arbitrary origin**: images use Base UI's `Avatar.Image` (via the shared `AvatarImage`; browser-native lazy load) rather than `<Image />` because arbitrary URLs can't be whitelisted in `next.config.ts`'s `images.remotePatterns`. The component comment documents this explicitly.
- **Large persona list**: each persona item wraps text; no truncation; the `<ul>` is scrollable by the parent container.
- **createdAt edge case**: `formatMemberSince` returns the locale-specific month+year. An invalid date string renders as "Invalid Date" — callers should validate upstream.

## Configuration

**Import path:**
```ts
import { UserCard, UserCardSkeleton, type UserCardDto } from '@adh-shared/ui/blocks/user-card';
```

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `user` | `UserCardDto` | yes | The profile DTO from the backend. |
| `className` | `string` | no | Extra Tailwind classes applied to the root `<article>`. |

**`UserCardDto` shape:**

| Field | Type | Description |
|---|---|---|
| `slug` | `string` | Unique user slug. Used as fallback display name. |
| `displayName` | `string \| null` | User's chosen display name. |
| `avatarUrl` | `string \| null` | Avatar image URL (arbitrary origin; not run through Next.js optimizer). |
| `createdAt` | `string \| null \| undefined` | ISO 8601 timestamp; rendered as "Member since Month Year". Omitted (e.g. an owner's own preview where no account date is available) hides the line. |
| `socialLinks` | `UserCardSocialLink[]` | Visible social links from the privacy-gated set. |
| `emails` | `string[]` | Visible email addresses. |
| `phones` | `string[]` | Visible phone numbers. |
| `addresses` | `UserCardAddress[]` | Visible physical addresses. |
| `personas` | `UserCardPersona[]` | Visible personas (public or unlisted). |

**`UserCardSkeleton` props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `className` | `string` | no | Extra classes on the skeleton root. |

## Logging

No logging. `UserCard` is a pure presentational component. It emits no telemetry
or structured log events. Error logging (e.g. avatar load failures) is delegated
to the browser console and handled by Base UI's `Avatar.Image` built-in error
handling (it transitions to error and reveals `Avatar.Fallback`).

## Platform Notes

- **Source file**: `websites/shared/ui/src/blocks/user-card.tsx`
- **Dist**: `@adh-shared/ui/blocks/user-card` (covered by the `./blocks/*` entry in
  `websites/shared/ui/package.json`).
- **Live demo**: `websites/local/ui-showcase/app/_ui/user-card-demo.tsx`
  (already exists — spec "Full card", "Identity only", and "Loading skeleton").
- **Hub consumer**: `websites/main/hub/src/components/profile/UserProfile.tsx`
  wraps `UserCard` with the hub's edit-profile affordance and the HUB+PUBLIC
  client-side upgrade fetch.
- **DTO structural alignment**: `UserCardDto` is intentionally a local structural
  duplicate of `components['schemas']['PublicUserProfile']` from
  `@adh-shared/api-types`. The duplicate keeps `@adh-shared/ui` free of the
  api-types dependency; callers may pass `SuccessBody<'/public/users/{slug}', 'get'>`
  directly since the shapes are identical.
- **Responsive**: verified at 375 / 768 / 1440 via Playwright.
- **`'use client'` boundary**: the component uses no server-specific APIs; the
  `'use client'` directive is present to ensure hydration works correctly and
  to allow future interactivity (e.g. avatar hover states) without a refactor.

## Design Decisions

- **No client-side privacy gating**: The component renders exactly what the DTO
  contains. Privacy logic lives entirely in the backend. This keeps the component
  simple and ensures the two card variants (PUBLIC, HUB+PUBLIC) share one render path.
- **`AvatarImage` over `<Image />`**: Avatar URLs come from arbitrary user-supplied
  origins that can't be enumerated in `next.config.ts`. Base UI's `Avatar.Image`
  gives browser-native lazy loading and a clean fallback via `AvatarFallback`
  (the image transitions to error and reveals `AvatarFallback`), without
  requiring an allowlist.
- **Structural DTO duplicate, not an import**: `UserCardDto` mirrors
  `PublicUserProfile` from api-types rather than importing it, keeping
  `@adh-shared/ui` from depending on `@adh-shared/api-types`. The structural
  match is enforced at the hub's call site by the TypeScript compiler.
- **`PLATFORM_LABELS` exported**: The platform label map is exported so the social-
  links settings editor can import it, making this file the single source of truth
  for platform display names.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex colors | Compliant | adh-ui-guidelines |
| No `!important` | Compliant | adh-ui-guidelines |
| `apt-*` tokens only | Compliant | adh-ui-guidelines |
| Loading state present | Compliant (`UserCardSkeleton`) | adh-ui-guidelines |
| Accessible article landmark | Compliant | WCAG 2.1 AA |
| Keyboard-navigable links | Compliant (native `<a>`) | WCAG 2.1 AA |
| Focus-visible ring | Compliant (`focus-visible:ring-2`) | WCAG 2.1 AA |
| Live demo in ui-showcase | Compliant | adh-recipe |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial recipe authoring for existing shared component. |
| 1.1.0 | 2026-07-03 | Mike Fullerton | Reattribute the avatar image engine from Radix to Base UI (`@base-ui/react/avatar`), matching `avatar.tsx`; behavior (load/error → initials fallback) unchanged. |
