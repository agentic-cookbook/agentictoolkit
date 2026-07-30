// The Chat help topic, as shown in the MODAL. The live assistant chat is the help site's own
// surface (help.adh.com/chat) — its backend/persona wiring lives in that app, not the shared
// package — so from the modal (mounted on every site) we link out to it rather than embedding a
// second chat with no backend. On the SSR help site the same `chat` topic renders the real
// InlineChat island via HelpSurface's `chatSlot`.
const HELP_CHAT_URL = 'https://help.agenticdeveloperhub.com/chat'

export function ChatTopic() {
  return (
    <div className="adh-help-topic adh-help-topic--chat">
      <EmptyChatCta />
    </div>
  )
}

function EmptyChatCta() {
  // Centered, matching where the live chat island sits on the help site (the shared
  // .adh-help-topic--chat pane bottom-centers its child with padding).
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p>Chat with bitbag, the Agentic Developer Hub assistant.</p>
      <a href={HELP_CHAT_URL} target="_blank" rel="noreferrer" className="adh-help-topic__link">
        Open the chat →
      </a>
    </div>
  )
}
