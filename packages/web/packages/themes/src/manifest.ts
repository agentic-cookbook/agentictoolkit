import {
  adhCss,
  adhComicCss,
  adhCourierCss,
  adhFiraCss,
  adhIosevkaCss,
  adhJetbrainsCss,
  adhManropeCss,
  agenticcookbookwebCss,
  devTeamCss,
  mikefullertonCss,
  myprojectsCss,
  myprojectsoverviewCss,
  professionalCss,
  techyCss,
  terminalCss,
  terminalSplitCss,
  whimsicalCss,
} from './theme-data'

export type ThemeKey =
  | 'adh'
  | 'adh-comic'
  | 'adh-courier'
  | 'adh-fira'
  | 'adh-iosevka'
  | 'adh-jetbrains'
  | 'adh-manrope'
  | 'agenticcookbookweb'
  | 'dev-team'
  | 'mikefullerton'
  | 'myprojects'
  | 'myprojectsoverview'
  | 'professional'
  | 'techy'
  | 'terminal'
  | 'terminal-split'
  | 'whimsical'

export interface ThemeEntry {
  id: ThemeKey
  label: string
  css: string
}

export const themes: Record<ThemeKey, ThemeEntry> = {
  adh: { id: 'adh', label: 'ADH', css: adhCss },
  'adh-comic': { id: 'adh-comic', label: 'ADH · Comic', css: adhComicCss },
  'adh-courier': { id: 'adh-courier', label: 'ADH · Courier', css: adhCourierCss },
  'adh-fira': { id: 'adh-fira', label: 'ADH · Fira', css: adhFiraCss },
  'adh-iosevka': { id: 'adh-iosevka', label: 'ADH · Iosevka', css: adhIosevkaCss },
  'adh-jetbrains': { id: 'adh-jetbrains', label: 'ADH · JetBrains', css: adhJetbrainsCss },
  'adh-manrope': { id: 'adh-manrope', label: 'ADH · Manrope', css: adhManropeCss },
  agenticcookbookweb: { id: 'agenticcookbookweb', label: 'Agentic Cookbook', css: agenticcookbookwebCss },
  'dev-team': { id: 'dev-team', label: 'Dev Team', css: devTeamCss },
  mikefullerton: { id: 'mikefullerton', label: 'Mike Fullerton', css: mikefullertonCss },
  myprojects: { id: 'myprojects', label: 'My Projects', css: myprojectsCss },
  myprojectsoverview: { id: 'myprojectsoverview', label: 'Projects Overview', css: myprojectsoverviewCss },
  professional: { id: 'professional', label: 'Professional', css: professionalCss },
  techy: { id: 'techy', label: 'Techy', css: techyCss },
  terminal: { id: 'terminal', label: 'Terminal', css: terminalCss },
  'terminal-split': { id: 'terminal-split', label: 'Terminal Split', css: terminalSplitCss },
  whimsical: { id: 'whimsical', label: 'Whimsical', css: whimsicalCss },
}

export const themeIds: ThemeKey[] = Object.keys(themes) as ThemeKey[]
