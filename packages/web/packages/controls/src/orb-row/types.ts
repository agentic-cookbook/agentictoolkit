export type OrbSite = {
  id: string
  name: string
  emoji: string
  iconGradient: string
  url: string
}

export type OrbRowProps = {
  sites: OrbSite[]
  currentSite?: OrbSite['id']
  docked?: boolean
  className?: string
}
