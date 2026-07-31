export { DeckScript, deckScript } from './deck/DeckScript'
export type { DeckScriptOptions } from './deck/DeckScript'
export { Deck } from './deck/Deck'
export { Screen } from './deck/Screen'
export type { ScreenProps } from './deck/Screen'
export { Wrap } from './deck/Wrap'
export { Split } from './deck/Split'
export { Glow } from './deck/Glow'
// NavChrome is deliberately NOT re-exported here — it is the package's only
// `'use client'` module, and importing it from this barrel would hoist that
// directive onto the whole bundle. It ships from `@agentic-toolkit/landing/chrome`.
// See src/chrome.ts.
//
// Its `NavLink` type does stay here, and that is not an oversight: `export type`
// is erased before esbuild sees it, so it creates no runtime import and cannot
// hoist anything. A host's link list is content — usually a plain module with no
// rendering in it — and making that module import from `/chrome` would imply a
// client boundary it does not have. `NavChromeProps` stays in `/chrome`, where
// the component is.
export type { NavLink } from './chrome/types'
export { Head } from './blocks/Head'
export { Lede } from './blocks/Lede'
export { Cards } from './blocks/Cards'
export { Card } from './blocks/Card'
export { Shot } from './blocks/Shot'
export type { ShotProps } from './blocks/Shot'
export { Versus } from './blocks/Versus'
export type { VersusSide } from './blocks/Versus'
export { Rule } from './blocks/Rule'
export type { RuleStep } from './blocks/Rule'
export { Stats } from './blocks/Stats'
export type { StatEntry } from './blocks/Stats'
export { Chips } from './blocks/Chips'
export type { ChipEntry } from './blocks/Chips'
export { Roadmap } from './blocks/Roadmap'
export { Checklist } from './blocks/Checklist'
export type { ChecklistGroup } from './blocks/Checklist'
export { Faq } from './blocks/Faq'
export type { FaqEntry } from './blocks/Faq'
export { Closer } from './blocks/Closer'
export { Contact } from './blocks/Contact'
export type { ContactProps } from './blocks/Contact'
export { Trust } from './blocks/Trust'
export { Cta } from './blocks/Cta'
export { Btn } from './blocks/Btn'
export { StatusPill } from './blocks/StatusPill'
export { Hero } from './blocks/Hero'
export type { HeroProps } from './blocks/Hero'
