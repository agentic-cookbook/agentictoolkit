// The persona toolkit's theme vocabulary, re-published from its owner.
// See ./chat.ts for why consumers must not name `@agenticdevelopertoolkit/*`
// directly. Themes make that rule load-bearing rather than merely tidy:
// `colorMode.tsx` builds its React context at MODULE SCOPE, so a provider on one
// copy and a consumer on the other never meet and `useColorMode` throws — naming
// React in the stack trace, not the boundary that actually caused it.
//
// Do NOT substitute `@agenticdevelopertoolkit/themes`. The two id sets are disjoint
// (`old-school-terminal` exists only here), so swapping them silently changes
// which themes exist and breaks the type contract of every `theme` prop —
// including `@agentic-toolkit/bitbag`'s, which is typed by `ThemeKey` below.

export {
  themes,
  themeIds,
  ThemeStyle,
  ColorModeProvider,
  useColorMode,
} from '@agenticdevelopertoolkit/themes'

export type {
  ThemeKey,
  ThemeEntry,
  ThemeStyleProps,
  ColorMode,
  ColorModeProviderProps,
  ResolvedColorMode,
} from '@agenticdevelopertoolkit/themes'
