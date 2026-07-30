'use client'

import { BitbagDock } from '@agentic-toolkit/bitbag'
import { useChatTheme } from './chat-theme-store'
// bitbag's CSS rides with THIS lazily-loaded chunk (not the always-loaded shared
// stylesheet), so pages that never open the chat don't pay for it. ONE sheet, not
// three: `bitbag-dock.css` `@import`s the underlying persona-chat base + inline sheets
// itself, because bitbag is what renders `InlineChatView` and this package must not
// name `@agenticdevelopertoolkit/*` — reaching into a sibling submodule for a
// dependency that was never its own is exactly the crossing the persona boundary bans.
import '@agentic-toolkit/bitbag/css/bitbag-dock.css'

/**
 * bitbag in the footer — the SAME fixture the studio site runs, not a second
 * chat that merely shares his name: his face riding above his chat, his mood and
 * gaze following the conversation, his own scripted voice. One component
 * (`BitbagDock`) mounted here and there, so the two can't drift into two bitbags.
 *
 * Loaded lazily + CLIENT-ONLY by FooterChat (`next/dynamic`, `ssr: false`) — so it
 * never server-renders (the transcript stamps `new Date()` + a random id per
 * message, and the avatar runs gsap timelines, neither of which survives
 * hydration) and its JS + CSS stay out of every site's first-paint bundle,
 * fetched only when the footer mounts on the client.
 *
 * No `backend` prop: he speaks his built-in scripted voice. The positioning
 * wrapper (`.adh-footer__chat`, see adh-components.css) bottom-anchors the column
 * so the transcript grows UPWARD out of the footer bar, and gives bitbag himself
 * headroom above the composer.
 *
 * The `theme` DOES come in as a prop, because it has to: bitbag emits his own
 * scoped `<ThemeStyle>` inside the dock, so a host stylesheet scoped to the
 * wrapper sits on a farther ancestor and never wins (see chat-theme-store).
 * Unset — every site but the hub, and the hub until someone picks one — he keeps
 * his own default skin.
 */
export default function FooterChatInner() {
  const [chatTheme] = useChatTheme()
  return <BitbagDock className="adh-footer__chat" theme={chatTheme ?? undefined} />
}
