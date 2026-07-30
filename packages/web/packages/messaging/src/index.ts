// Public surface of @agentic-toolkit/messaging. Individual files are also reachable via
// the ./hooks/* and ./components/* subpath exports; this barrel re-exports them so
// consumers can `import { NotificationBell, useUnreadCount } from '@agentic-toolkit/messaging'`.

export {
  useUnreadCount,
  useInbox,
  type Notification,
  type NotificationStatus,
  type InboxParams,
  type InboxResponse,
  type UseInboxResult,
} from './hooks/use-notifications'
export { NotificationBell } from './components/notification-bell'
export { NotificationInbox } from './components/notification-inbox'

export {
  useDmConversations,
  useDmThread,
  startDm,
  type DmMessage,
  type DmMessagePreview,
  type DmChatSummary,
  type DmConversation,
  type PresenceView,
  type StartDmResult,
  type UseDmConversationsResult,
  type UseDmThreadResult,
} from './hooks/use-dms'
export { PresenceDot } from './components/presence-dot'
export { DmList } from './components/dm-list'
export { DmThread } from './components/dm-thread'
export { DmPanel } from './components/dm-panel'
