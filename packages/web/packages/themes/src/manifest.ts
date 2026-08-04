import {
  adhCss,
  adhComicCss,
  adhCourierCss,
  adhFiraCss,
  adhIosevkaCss,
  adhDevPreviewCss,
  adhJetbrainsCss,
  adhManropeCss,
  agenticcookbookwebCss,
  charcoalCss,
  devTeamCss,
  fishlampCss,
  greenMatrixCss,
  greenMatrixGlassCss,
  mikefullertonCss,
  myprojectsCss,
  myprojectsoverviewCss,
  oldSchoolTerminalCss,
  professionalCss,
  techyCss,
  terminalCss,
  terminalSplitCss,
  whimsicalCss,
  gruvboxCss,
  nordCss,
  rosePineCss,
  signalCss,
  solarizedCss,
  catppuccinCss,
  cobalt2Css,
  draculaCss,
  githubCss,
  monokaiCss,
  oneDarkCss,
  synthwave84Css,
  tokyoNightCss,
  vesperCss,
} from './theme-data'

export type ThemeKey =
  | 'adh'
  | 'adh-comic'
  | 'adh-courier'
  | 'adh-dev-preview'
  | 'adh-fira'
  | 'adh-iosevka'
  | 'adh-jetbrains'
  | 'adh-manrope'
  | 'agenticcookbookweb'
  | 'charcoal'
  | 'dev-team'
  | 'fishlamp'
  | 'green-matrix'
  | 'green-matrix-glass'
  | 'mikefullerton'
  | 'myprojects'
  | 'myprojectsoverview'
  | 'old-school-terminal'
  | 'professional'
  | 'techy'
  | 'terminal'
  | 'terminal-split'
  | 'whimsical'
  | 'gruvbox'
  | 'nord'
  | 'rose-pine'
  | 'signal'
  | 'solarized'
  | 'catppuccin'
  | 'cobalt2'
  | 'dracula'
  | 'github'
  | 'monokai'
  | 'one-dark'
  | 'synthwave84'
  | 'tokyo-night'
  | 'vesper'

export interface ThemeEntry {
  id: ThemeKey
  label: string
  css: string
}

export const themes: Record<ThemeKey, ThemeEntry> = {
  adh: { id: 'adh', label: 'ADH', css: adhCss },
  'adh-comic': { id: 'adh-comic', label: 'ADH · Comic', css: adhComicCss },
  'adh-courier': { id: 'adh-courier', label: 'ADH · Courier', css: adhCourierCss },
  'adh-dev-preview': { id: 'adh-dev-preview', label: 'ADH · Dev Preview', css: adhDevPreviewCss },
  'adh-fira': { id: 'adh-fira', label: 'ADH · Fira', css: adhFiraCss },
  'adh-iosevka': { id: 'adh-iosevka', label: 'ADH · Iosevka', css: adhIosevkaCss },
  'adh-jetbrains': { id: 'adh-jetbrains', label: 'ADH · JetBrains', css: adhJetbrainsCss },
  'adh-manrope': { id: 'adh-manrope', label: 'ADH · Manrope', css: adhManropeCss },
  agenticcookbookweb: { id: 'agenticcookbookweb', label: 'Agentic Cookbook', css: agenticcookbookwebCss },
  charcoal: { id: 'charcoal', label: 'Charcoal', css: charcoalCss },
  'dev-team': { id: 'dev-team', label: 'Dev Team', css: devTeamCss },
  fishlamp: { id: 'fishlamp', label: 'Fishlamp', css: fishlampCss },
  'green-matrix': { id: 'green-matrix', label: 'Green Matrix', css: greenMatrixCss },
  'green-matrix-glass': {
    id: 'green-matrix-glass',
    label: 'Green Matrix (Glass)',
    css: greenMatrixGlassCss,
  },
  mikefullerton: { id: 'mikefullerton', label: 'Mike Fullerton', css: mikefullertonCss },
  myprojects: { id: 'myprojects', label: 'My Projects', css: myprojectsCss },
  myprojectsoverview: { id: 'myprojectsoverview', label: 'Projects Overview', css: myprojectsoverviewCss },
  'old-school-terminal': {
    id: 'old-school-terminal',
    label: 'Old School Terminal',
    css: oldSchoolTerminalCss,
  },
  professional: { id: 'professional', label: 'Professional', css: professionalCss },
  techy: { id: 'techy', label: 'Techy', css: techyCss },
  terminal: { id: 'terminal', label: 'Terminal', css: terminalCss },
  'terminal-split': { id: 'terminal-split', label: 'Terminal Split', css: terminalSplitCss },
  whimsical: { id: 'whimsical', label: 'Whimsical', css: whimsicalCss },
  gruvbox: { id: 'gruvbox', label: 'Gruvbox', css: gruvboxCss },
  nord: { id: 'nord', label: 'Nord', css: nordCss },
  'rose-pine': { id: 'rose-pine', label: 'Rosé Pine', css: rosePineCss },
  signal: { id: 'signal', label: 'Signal', css: signalCss },
  solarized: { id: 'solarized', label: 'Solarized', css: solarizedCss },
  catppuccin: { id: 'catppuccin', label: 'Catppuccin', css: catppuccinCss },
  cobalt2: { id: 'cobalt2', label: 'Cobalt2', css: cobalt2Css },
  dracula: { id: 'dracula', label: 'Dracula', css: draculaCss },
  github: { id: 'github', label: 'GitHub', css: githubCss },
  monokai: { id: 'monokai', label: 'Monokai', css: monokaiCss },
  'one-dark': { id: 'one-dark', label: 'One Dark', css: oneDarkCss },
  synthwave84: { id: 'synthwave84', label: "Synthwave '84", css: synthwave84Css },
  'tokyo-night': { id: 'tokyo-night', label: 'Tokyo Night', css: tokyoNightCss },
  vesper: { id: 'vesper', label: 'Vesper', css: vesperCss },
}

export const themeIds: ThemeKey[] = Object.keys(themes) as ThemeKey[]
