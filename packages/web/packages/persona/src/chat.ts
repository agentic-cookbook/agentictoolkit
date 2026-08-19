// The persona toolkit's chat vocabulary, re-published from its owner.
//
// Consumers import from here rather than naming `@agenticdevelopertoolkit/chat`
// themselves. That is not a style preference — it is the only thing that keeps
// ONE copy of the package in a bundle. adh holds `agenticdevelopertoolkit` twice
// (its own submodule, and the one nested inside this repo), and a bare specifier
// in a shipped `dist` resolves from the importing file's REAL path, not from the
// consuming site. So a site that names the scope directly resolves adh's copy,
// while anything reaching chat through this repo resolves the nested copy, and
// nothing dedupes across two different directories. A site that never names the
// scope cannot acquire the second copy.
//
// Do NOT substitute `@agentic-toolkit/chat`. It is an older, pruned snapshot of
// this same code (3 commits, all scope-rename chores, consumed only by
// `websites/site`) and it is missing the entire API the real consumers use:
// `statusUtterance`, `thinkingLabels`, the `inactive`/`minimal` idle state, the
// `transition` option, and the `{ active, inactive, transition }` shape of
// `InlineChatSizing` — which it defines under the same name as a DIFFERENT type
// (the union this package calls `ChatSizingBehavior`). Swapping would be a
// compile break and a silent feature regression, not a move.

export {
  InlineChat,
  InlineChatView,
  ThreePaneChat,
  ThreePaneChatView,
  MobileChat,
  MobileChatView,
  PersonaChat,
  Transcript,
  ContentOverlay,
  MockBackend,
  FetchBackend,
  useChatSession,
  TypingIndicator,
  // The persona-chat input mechanism: caret geometry, the tracker that keeps it
  // live, and the focus keeper. Persona-agnostic on purpose — they carry no
  // vocabulary, only the plumbing a terminal-style composer needs (a native
  // <input> caret cannot be reshaped in CSS, so a theme that wants a block
  // cursor has to have one drawn for it). Re-exported here for the same reason
  // as everything above: a consumer that named `@agenticdevelopertoolkit/chat`
  // to reach them would pull a second copy of the whole chat package.
  caretMetrics,
  useCaretTracker,
  useBlockCursor,
  useInputFocusReclaim,
  CHAT_INPUT_SELECTOR,
} from '@agenticdevelopertoolkit/chat'

export type {
  CaretMetrics,
  ChatBackend,
  ChatSession,
  ChatParticipant,
  ChatMessage,
  ChatResponse,
  ChatMode,
  ContentOverlayProps,
  InlineChatSizing,
  ChatSizingBehavior,
  InactiveSizingBehavior,
  SizingTransition,
  StatusWordPair,
  StatusTintSpec,
  TypingIndicatorProps,
} from '@agenticdevelopertoolkit/chat'
