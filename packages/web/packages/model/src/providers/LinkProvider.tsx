'use client'

import { createContext, useContext, type ComponentType, type ReactNode, type AnchorHTMLAttributes } from 'react'

export type LinkComponentProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string
  children?: ReactNode
}
export type LinkComponent = ComponentType<LinkComponentProps>

const DefaultLink: LinkComponent = ({ to, children, ...rest }) => (
  <a href={to} {...rest}>{children}</a>
)

const LinkContext = createContext<LinkComponent>(DefaultLink)

export function LinkProvider({ Component, children }: { Component: LinkComponent; children: ReactNode }) {
  return <LinkContext.Provider value={Component}>{children}</LinkContext.Provider>
}

export function useLink(): LinkComponent {
  return useContext(LinkContext)
}
