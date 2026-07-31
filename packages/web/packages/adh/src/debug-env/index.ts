// The environment/debug console — the MERGE of this package's (then `@adh-shared/adh`) two
// former subtrees
// `debug/` (the env-var inventory + its list view) and `debug-console/` (the floating
// console window that renders it). They land in ONE directory here because this package
// already publishes a `./debug` subpath (the DebugMenu / ChatThemeSwitcher), so the two
// names collided; `./debug-env` names what the merged tree actually is.
//
// The two HOST surfaces the console needs — the environment-override store and the theme
// taxonomy — are injected as props, never imported. See `./seams`.

// ── the console window ───────────────────────────────────────────────────────────────
export { DebugConsoleWindow, type DebugConsoleWindowProps } from './DebugConsole'
// Re-exported because this package's own `help/HelpWindow.tsx` (and any other host that wants a
// backdrop-less draggable window) reaches it through this barrel rather than a deep path. Since
// Task 5.5 that reach is a SELF-reference — `@agentic-toolkit/adh/debug-env`, kept in tsup's
// `external` so the console and the help window share one FloatingWindow geometry module.
export { FloatingWindow } from './FloatingWindow'
export {
  DebugConsoleProvider,
  useDebugConsoleConfig,
  type DebugConsoleConfig,
  type DebugConsoleChatTheme,
} from './DebugConsoleProvider'
export type {
  EnvOverrideSurface,
  ThemeAreasSurface,
  ThemeAreasLoader,
  DebugThemeArea,
  DebugThemeItem,
} from './seams'

// ── the env-var inventory (former `@adh-shared/adh/debug`) ───────────────────────────
export { EnvVarList } from './EnvVarList'
export type { EnvVarListProps } from './EnvVarList'
export {
  collectEnvVars,
  isSecretName,
  maskValue,
  debugEnvEntries,
  SITE_ENV_VARS,
} from './env-vars'
export type { EnvVarEntry } from './env-vars'
