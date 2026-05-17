# `@agentic-cookbook/agentic-web-toolkit/filtered-list`

A reusable filtered list. Configuration is generic over your item type —
you tell the package how to read a title / subtitle / details out of each
item; the package owns the input, the list, and the filter logic.

## Why a package

The same pattern (a search input above a list of cards) shows up in
service pickers, persona pickers, model dropdowns, and admin tables. A
shared package keeps the filter logic, keyboard behavior, and theme
hookup in one place.

## Configuration vs. UI

Two entry points:

- `useFilteredList(config)` — headless hook. Pass items + accessors,
  receive `{ query, setQuery, visible }`. Use this when you have your own
  list UI but want the matching behavior.
- `<FilteredList />` — presentational component built on the hook. Use
  this when you want the full input + list rendering.

## Usage

```tsx
import { FilteredList } from '@agentic-cookbook/agentic-web-toolkit/filtered-list'
import '@agentic-cookbook/agentic-web-toolkit/filtered-list/styles/filtered-list.css'

type Service = { id: string; name: string; providerKind: string; baseUrl: string }

<FilteredList<Service>
  items={services}
  getId={(s) => s.id}
  getTitle={(s) => s.name}
  getSubtitle={(s) => s.providerKind}
  getDetails={(s) => s.baseUrl}
  placeholder="Filter by name, provider, or URL…"
  onSelect={(s) => onPick(s)}
  footer={<button onClick={onCustom}>+ Custom</button>}
/>
```

### Custom row rendering

Pass `renderItem` to override the default title/subtitle/details layout
without losing the filter:

```tsx
<FilteredList<Service>
  items={services}
  getId={(s) => s.id}
  getTitle={(s) => s.name}
  renderItem={(s) => (
    <div>
      <strong>{s.name}</strong>
      <code>{s.baseUrl}</code>
    </div>
  )}
/>
```

`getTitle` is still required — the default matcher uses it. If you supply
a custom `match` function you can ignore the accessors entirely.

### Headless

```tsx
const { query, setQuery, visible } = useFilteredList({
  items: services,
  getId: (s) => s.id,
  getTitle: (s) => s.name,
  getSubtitle: (s) => s.providerKind,
  getDetails: (s) => s.baseUrl,
})
```

## Keyboard

When the input has focus:

- <kbd>↓</kbd> from an empty highlight selects the first visible item; subsequent
  <kbd>↓</kbd>/<kbd>↑</kbd> navigate the list.
- The highlighted item&rsquo;s `getTitle()` value fills the input as the
  highlight moves — typing again clears the highlight and resumes filtering.
- <kbd>Enter</kbd> fires `onSelect(highlightedItem)`.
- <kbd>Esc</kbd> clears the highlight without changing the query.

`onHighlightChange(item | null)` lets the consumer react to highlight moves
(e.g. to preview the selection upstream).

## Theming

The component uses CSS custom properties from the toolkit's `themes`
package — `--color-surface-raised`, `--color-text-primary`, `--color-accent`,
etc. — with hardcoded fallbacks. Mount a `<ThemeStyle theme="…" />` in
your shell and the list restyles automatically.

Override any class (`.fl-input`, `.fl-list`, `.fl-item`, `.fl-title`,
`.fl-subtitle`, `.fl-details`, `.fl-empty`, `.fl-footer`) for component-
level customization.

## Search behavior

Default matcher: case-insensitive substring across `getTitle`,
`getSubtitle`, `getDetails`, and any strings returned by
`getSearchableExtras(item)`. Pass `match` to plug in a different
algorithm (fuzzy, prefix-only, regex).
