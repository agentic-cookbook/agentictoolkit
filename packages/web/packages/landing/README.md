# `@agentic-toolkit/landing`

A snap-scrolling, long-form landing page kit: the scroll deck (snap mechanism,
arming script, screen unit), the fixed-header chrome (burger, drawer, scrim),
and a vocabulary of ~20 presentational blocks (head, cards, versus, stats,
chips, roadmap, checklist, faq, closer, hero…). The package names no colour,
no font family and no copy — every visual value reads a `--lp-*` custom
property, and every block takes its content as props/children. A consuming
site becomes a palette, a token map, and a set of compositions.

## Why a new package, and not an extension of `viewport`

`@agenticdevelopertoolkit/viewport` — a package in the sibling
agenticdevelopertoolkit repo, which several consumer sites load alongside this
one — opens its `css/base.css` with `html, body { overflow: hidden }`. It
**locks the page to the visible viewport** so an inner shell can scroll. This
deck needs the opposite: the *document* is the scroller, because Safari only
collapses its toolbar in response to the document scroller moving (measured).
The two stylesheets can never be loaded on the same page, so `landing` is a
sibling of `viewport`, not a layer on it. A site may use both packages, but not
on the same element: it may reuse `viewport`'s hooks (JS) and never its CSS.

## Why not route page colour through `@agentic-toolkit/themes`

`themes` skins a widget subtree: `ThemeStyle` rewrites a theme stylesheet into
`@scope (.pc-theme-scope) { … }`, so by construction it cannot reach `html`,
`body`, or a page's sections. That is the right shape for a chat dock inside a
page, and the wrong one for the page itself, so page colour goes through a
plain custom-property contract instead — prefix `--lp-*`.

The two compose rather than compete, and a site is expected to load both. Note
that `themes` does also ship page-level CSS that is *not* scoped —
`styles/accessibility.css` keys off `html[data-reduce-motion]`,
`html[data-contrast]` and `html[data-text-size]`. That is a different concern
from palette, it styles no `--lp-*` token, and nothing here overrides it.

## Install

```tsx
import { Deck, Screen /* … */ } from '@agentic-toolkit/landing'
import { NavChrome } from '@agentic-toolkit/landing/chrome'
import '@agentic-toolkit/landing/css/base.css'   // deck + screen mechanics
import '@agentic-toolkit/landing/css/chrome.css' // header, burger, drawer
import '@agentic-toolkit/landing/css/blocks.css' // the block vocabulary
```

**`NavChrome` comes from `/chrome`, and that split is load-bearing.** It is the
only `'use client'` module in the package, and the bundler propagates a chunk's
directive to every entry that imports it — so while `NavChrome` was re-exported
from the main barrel, `dist/index.js` itself began with `'use client'` and every
export in it became a Client Component. Two entries built from two chunk graphs
is what keeps the main barrel server-safe; `tools/check-directives.py` asserts
it on every build, because nothing else can see it.

All three CSS files are required (`base.css` alone won't paint a chip or a
hero). Import order relative to the host's own stylesheet does not matter for
correctness — see the fallback rule below — but importing all three from one
place (a root layout) is the simplest way to be sure none is missed.

**Every colour, radius, gap and shadow in this package's CSS is a bare
`var(--lp-*, <fallback>)` read — never a value in a `:root` block.** Package
CSS is imported from inside a component, so in Next's build it lands *after*
the host's own `globals.css`. A `:root { --lp-ink: #e8e8e8 }` written by the
package would load second and silently beat the host's own `:root`
assignment. An inline fallback only ever applies when the property is
genuinely unset, so it is order-proof: the host can set its tokens in its own
`:root`, in a media query, in a `[data-theme]` selector — anything — and the
package never fights it. The cost of that safety is that every fallback has to
be written at every use site, which is also why the fallback literals below
are the *complete* list of what a host must override to fully re-theme the
page (see **Tokens**).

## Minimal example

Composes the scroll mechanism (`DeckScript`, `Deck`, `Screen`), the chrome
(`NavChrome`), and two blocks (`Hero`, `Wrap` + `Head`):

```tsx
import { DeckScript, Deck, Hero, Screen, Wrap, Head } from '@agentic-toolkit/landing'
import { NavChrome } from '@agentic-toolkit/landing/chrome'
import '@agentic-toolkit/landing/css/base.css'
import '@agentic-toolkit/landing/css/chrome.css'
import '@agentic-toolkit/landing/css/blocks.css'

export default function Page() {
  return (
    <>
      <DeckScript />
      <NavChrome brand="Acme" links={[{ href: '#pitch', label: 'Pitch' }]} />
      <Deck>
        <Hero id="top" headline="On the record." tagline="It records things." />
        <Screen id="pitch"><Wrap><Head title="Why it's different" /></Wrap></Screen>
      </Deck>
    </>
  )
}
```

`DeckScript` must render first inside `<body>` — it is a literal inline
`<script>`, which is what lets it run before hydration (arm scroll-snap on
first input, force `history.scrollRestoration="manual"`, strip iOS's
zoom-on-focus). `NavChrome` is `'use client'`; everything else here is a plain
function component.

## What's in the package

Everything below ships from `@agentic-toolkit/landing` except `NavChrome`, which
ships from `@agentic-toolkit/landing/chrome` for the reason under **Install**.

| Export | Layer | What it is |
| --- | --- | --- |
| `DeckScript` / `deckScript()` | deck | The three pre-hydration behaviours above, as a component or a raw string. |
| `Deck` | deck | The non-scrolling flow parent of the screens — the document is the scroller. |
| `Screen` | deck | One full-viewport, snap-point screen. `align="top"` (default) parks content high; `align="center"` is the hero's case. |
| `Wrap` | deck | The width-limited content column inside a `Screen`. |
| `Split` | deck | Two panels side by side above a breakpoint, stacked below it. |
| `Glow` | deck | The hero's decorative radial glow (`aria-hidden`). |
| `NavChrome` | chrome | Fixed header + burger + drawer + scrim, as one client component. |
| `Head` | blocks | A section's eyebrow + title + lede slot. |
| `Lede` | blocks | The standalone paragraph under a `Head` (or after a card grid, a chip list…). |
| `Cards` / `Card` | blocks | A tile grid and its tiles. `Cards pair` forces an explicit two-column track. |
| `Shot` | blocks | A screenshot frame; renders an obviously-unfinished placeholder when `media` is absent. |
| `Versus` | blocks | The two-panel "what they do / what we do instead" comparison. |
| `Rule` | blocks | An oversight rule set in type — a feature whose UI isn't captured yet, shown honestly rather than faked. |
| `Stats` | blocks | A one-sweep strip of number + caption cells. |
| `Chips` | blocks | A wrapped row of provider chips; `soon` switches to the dashed/dimmed "not yet" treatment. |
| `Roadmap` | blocks | The eyebrow-led block that introduces a `Chips soon` list. |
| `Checklist` | blocks | Grouped columns of ticked feature lines. |
| `Faq` | blocks | Native `<details>`/`<summary>` accordion — no JS state. |
| `Closer` | blocks | A closing section's heading + prose. `Contact` composes it. |
| `Contact` | blocks | A `Closer` plus a mailto link and an optional colophon line. |
| `Trust` | blocks | The hero's inline trust-signal list (free, platform, etc). |
| `Cta` | blocks | The hero's button row wrapper. |
| `Btn` | blocks | A link styled as a button; `variant="primary"` (default) or `"ghost"`. |
| `StatusPill` | blocks | The hero's status line; `free` switches to the accented "free" treatment (`--lp-status-free-border`). |
| `Hero` | blocks | The one centred `Screen` on the page: glow, mark, headline, tagline, children (`Cta`/`Trust`/`StatusPill`, in the host's own order). |

None of these render an `<img>` or a `next/link` — the package depends on
nothing outside `packages/web/packages/*`. Anything image-shaped is a
`ReactNode` prop the host fills with its own `<Image>` or `<img>`.

## Tokens

The package reads two kinds of `--lp-*` custom property: the **base
contract**, one per token the site already had a name for, and the **minted**
set, one per literal colour/tint the port turned up that no existing token
covered. **A host that wants to fully re-theme this package must set every
row in *both* tables below, not just the base one** — the minted rows'
fallbacks are the same neutral greyscale as the base rows' (present so an
unconfigured host renders a legible page, never a design of its own — see the
note below the base table). Leaving the minted tokens unset on a re-themed
site means most of the chrome takes the host's palette while a scattering of
borders and one button's ink stay the default grey — inert, not a bug in a
single component.

### Base contract

| Site (`globals.css`) | Package token | Inline fallback |
| --- | --- | --- |
| `--color-ground` | `--lp-ground` | `#101010` |
| `--color-ground-raise` | `--lp-raise` | `#1c1c1c` |
| `--color-gold` | `--lp-accent` | `#9a9a9a` |
| `--color-gold-bright` | `--lp-accent-bright` | `#d8d8d8` |
| `--color-gold-dim` | `--lp-accent-dim` | `rgba(216,216,216,0.14)` |
| `--color-ivory` | `--lp-ink` | `#ededed` |
| `--color-ivory-dim` | `--lp-ink-dim` | `#a0a0a0` |
| `--color-hairline` | `--lp-hairline` | `rgba(216,216,216,0.18)` |
| `--font` | `--lp-font` | `ui-monospace, "SF Mono", monospace` |
| `--font-mono` | `--lp-font-mono` | `ui-monospace, "SF Mono", monospace` |
| `--measure` | `--lp-measure` | `70rem` |
| `--radius` | `--lp-radius` | `14px` |
| `--card` | `--lp-card` | `rgba(255,255,255,0.04)` |
| `--glow` | `--lp-glow` | `radial-gradient(circle, rgba(216,216,216,0.10), transparent 65%)` |
| `--section-gap` | `--lp-gap` | `clamp(3.75rem, 8vw, 6.5rem)` |
| `--dock-clear` | `--lp-dock-clear` | `0px` |

`--font` and `--font-mono` are separate rows even though they are
byte-identical on the source site. `--lp-font-mono` is the package's one
deliberately-monospaced role — the small technical label on `StatusPill`
(`.lp-status`) — kept apart from `--lp-font` so a host with a proportional
body face can still ask for that one label in mono. It is not a Stenographer
literal, which is why it sits in this table rather than the minted one below.

Seven tokens are new to the package — the dials that let a second site differ
from the first:

| Token | Fallback | What it does |
| --- | --- | --- |
| `--lp-snap-stop` | `normal` | `scroll-snap-stop` on a screen. fishlamp sets `always` (five screens, one flick each); Stenographer leaves it `normal` (thirteen screens). This is the *only* measured difference between the two sites' snap CSS. |
| `--lp-screen-pad-top` | `clamp(5.5rem, 14svh, 9rem)` | Where content parks. Must clear the fixed header. |
| `--lp-hero-pad-top` | `6.5rem` | Hero head padding; the glow's offset is derived from it. |
| `--lp-hero-pad-bottom` | `var(--lp-dock-clear, 0px)` | Hero foot padding; reserves whatever fixed chrome the site docks at the bottom. |
| `--lp-root-size` | `87.5%` | The root type dial. |
| `--lp-checklist-mark` | `"✓"` | The mark before each checklist item. A CSS string, quotes included. It sits in a fixed `1.2rem` grid column, so a replacement wants to be about that wide. |
| `--lp-versus-bullet` | `"· "` | The bullet before each wedge-panel point. A CSS string; set it to `""` for no bullet. |

The last two are the only characters the package would otherwise put on the
page itself. They are tokens for the same reason everything visible here is:
the package owns the UI, the site owns the words. `content` accepts a `var()`
with a string fallback, so they follow the same inline-default rule as the
colours and need no `:root` block.

**The fallback column above is deliberately neutral greyscale, and is NOT this
site's palette.** Stenographer is navy and gold — `--color-ground: #0C1020`,
`--color-ground-raise: #1B2340`, `--color-gold: #EF9E00`, `--color-gold-bright:
#FFD75E`, `--color-ivory: #FCF6E8`, `--color-ivory-dim: #DCC79E`. The package
defaults to grey on purpose: a shared library that ships another product's
brand as its unthemed default is a trap, and grey reads instantly as "nobody
set the tokens."

### Minted tokens

The site's stylesheet also carried literal colours that no `--color-*` token
ever covered — all `rgba()` with baked-in alpha, because a token can't carry
two opacities. Each one turned out to be a palette colour at some alpha (the
burger backdrop's literal, for instance, was `--color-ground` at 60% in the
original site), which is exactly why they were easy to miss: they read as
arbitrary literals and were in fact the palette in disguise. Each was minted
as its own `--lp-<role>` token — named for the role it plays, not the colour
it is — with a neutral fallback at the same alpha as its inline default,
matching the base contract's rule above, and a row added here. Two mints are
byte-identical to another mint above; they still get separate tokens, because
the two roles (a card's hover state, a wedge panel's identity) must stay free
to diverge even though they started life at the same value. `→` records which
site colour and alpha each token was *minted from* in the original port — it
is provenance, not the fallback below, which per the neutral-greyscale rule is
grey:

| Token | Fallback | `→` | What it does | Task |
| --- | --- | --- | --- | --- |
| `--lp-burger-bg` | `rgba(16, 16, 16, 0.6)` | ground @ 60% | The burger button's own backdrop, so it stays legible over whatever it floats above. | 3 |
| `--lp-scrim-bg` | `rgba(16, 16, 16, 0.55)` | ground @ 55% | The scrim that dims the page behind an open drawer. | 3 |
| `--lp-drawer-shadow` | `rgba(0, 0, 0, 0.55)` | — (pure black) | The drawer's cast shadow. | 3 |
| `--lp-nav-divider` | `rgba(237, 237, 237, 0.07)` | ivory @ 7% | The hairline under each drawer link. | 3 |
| `--lp-card-hover-border` | `rgba(216, 216, 216, 0.4)` | gold-bright @ 40% | A card's border once pointed at. | 4 |
| `--lp-card-hover-bg` | `rgba(28, 28, 28, 0.62)` | raise @ 62% | A card's fill once pointed at. | 4 |
| `--lp-shot-hover-border` | `rgba(216, 216, 216, 0.45)` | gold-bright @ 45% | A screenshot frame's border once pointed at. | 4 |
| `--lp-shot-hover-glow` | `rgba(216, 216, 216, 0.5)` | gold-bright @ 50% | The bloom cast by a hovered screenshot frame. | 4 |
| `--lp-shot-bar-shade` | `rgba(16, 16, 16, 0.6)` | ground @ 60% | The title bar atop a screenshot frame. | 4 |
| `--lp-shot-dot` | `rgba(237, 237, 237, 0.22)` | ivory @ 22% | The three window dots in that bar. | 4 |
| `--lp-shot-hatch` | `rgba(216, 216, 216, 0.05)` | gold-bright @ 5% | The hatch fill behind a placeholder screenshot. | 4 |
| `--lp-versus-border` | `rgba(237, 237, 237, 0.09)` | ivory @ 9% | The wedge panel's default border, before either side is distinguished. | 5 |
| `--lp-versus-us-border` | `rgba(216, 216, 216, 0.4)` | gold-bright @ 40% | The border on the wedge's "us" panel. Byte-identical to `--lp-card-hover-border` but minted separately — a card's hover state and a wedge panel's identity must stay free to diverge. | 5 |
| `--lp-versus-us-glow` | `rgba(216, 216, 216, 0.55)` | gold-bright @ 55% | The bloom cast by the wedge's "us" panel, the one the comparison is built to make readers notice first. | 5 |
| `--lp-rule-bg` | `rgba(16, 16, 16, 0.65)` | ground @ 65% | The oversight rule's own backdrop. | 5 |
| `--lp-chip-bg` | `rgba(28, 28, 28, 0.35)` | raise @ 35% | A shipped provider chip's fill. | 5 |
| `--lp-chip-open-border` | `rgba(216, 216, 216, 0.5)` | gold-bright @ 50% | The border on a chip marked open. Byte-identical to `--lp-shot-hover-glow` but minted separately for the same reason as the wedge's pair above. | 5 |
| `--lp-chip-soon-border` | `rgba(160, 160, 160, 0.28)` | ivory-dim @ 28% | The dashed border on a planned-agent chip — one of three signals (dashed, dimmed, no accent) that stack to say "not yet" without a legend. | 5 |
| `--lp-status-free-border` | `rgba(216, 216, 216, 0.5)` | gold-bright @ 50% | The border on the hero's "free" status pill. Byte-identical to `--lp-chip-open-border` but minted separately — a status pill and a provider chip must stay free to diverge. | 6 |
| `--lp-btn-primary-ink` | `#101010` | — (not a palette colour) | The primary button's text colour — the ink printed ON the accent fill, not the accent itself. Close to but distinct from `--lp-ground` (`#0C1020`); folding the two together would be a visual change wearing a refactor's clothes. | 6 |
| `--lp-faq-divider` | `rgba(237, 237, 237, 0.09)` | ivory @ 9% | The hairline under each FAQ row. Byte-identical to `--lp-versus-border` but minted separately — a wedge panel's border and a FAQ divider must stay free to diverge. | 6 |

This table grows as ports proceed. When a future port turns up a literal
colour, shadow or tint with no token, the rule is: mint a `--lp-<role>` token
named for its role, write the existing literal verbatim as its inline
fallback, and add a row here — never fold it into an existing token because
the values look close, since that is a visual change wearing a refactor's
clothes.

## Build

From `packages/web/`:

```bash
pnpm --filter @agentic-toolkit/landing build   # tsup + tsc --emitDeclarationOnly + copy-css.mjs
pnpm --filter @agentic-toolkit/landing lint    # tsc --noEmit
pnpm test landing                                      # vitest, this package's suites
```
