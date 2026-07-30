'use client'

import dynamic from 'next/dynamic'

// Load the chat lazily + CLIENT-ONLY. `ssr: false` keeps it out of the server
// HTML — its welcome message carries a `new Date()` timestamp + random id that
// would hydration-mismatch on every page — and code-splits InlineChat + the chat
// CSS out of every site's first-paint bundle (fetched only when the footer
// actually mounts on the client). The separate `FooterChatInner` dist entry is
// kept un-inlined via the package subpath export (see tsup.config.ts external).
const FooterChatInner = dynamic(() => import('@agentic-toolkit/adh/footer/FooterChatInner'), {
  ssr: false,
})

/**
 * The persona chat embedded in the center of the shared footer — so it appears,
 * identically, on every family site. A thin loader: the actual chat (and its
 * weight) lives in FooterChatInner, pulled in only on the client.
 */
export function FooterChat() {
  return <FooterChatInner />
}
