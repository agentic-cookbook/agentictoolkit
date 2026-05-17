import {
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
