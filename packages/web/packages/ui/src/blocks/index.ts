export { AppTabs, type AppTab } from "./app-tabs"
export { EditorSection, type EditorSectionItem } from "./editor-section"
export { MarkdownEditor, type MarkdownEditorProps } from "./markdown-editor"
export { Field } from "./field"
export { FieldGroup } from "./field-group"
export { TopicDetail, type TopicDetailItem, type RailSlot } from "./topic-detail"
export { TopicOverview } from "./topic-overview"
export {
  HierarchicalTopicDetail,
  type TopicLevel,
  type PaneExitGuard,
} from "./hierarchical-topic-detail"
// Hierarchical Menu Details View — the cascading (vertical nested-menu) experiment, isolated as its
// own component so HTDV stays at its pre-experiment shape. Shares HTDV's TopicLevel/PaneExitGuard.
export { HierarchicalMenuDetail } from "./hierarchical-menu-detail"
// The switch between the two while the experiment runs. Consumers render HierarchicalDetailView and
// the host app picks the view once, via the provider; the two components above are then an
// implementation detail. Default (no provider) = HTDV, so nothing changes for an app that opts out.
export {
  HierarchicalDetailView,
  HierarchicalDetailViewProvider,
  useHierarchicalMenuDetailView,
  type HierarchicalDetailViewProps,
} from "./hierarchical-detail-view"
// Dev-only debug switches (mouse-detection frames, 10x-slow animations). They live here because
// this package owns the behaviour; a consuming app's Debug panel flips them, and the app applies
// `slowAnimationVars` to <html> once (see its AppShell) so portaled dialogs/menus scale too.
export {
  useShowDebugFrames,
  setShowDebugFrames,
  getShowDebugFrames,
  useSlowAnimations,
  setSlowAnimations,
  getSlowAnimations,
  useCascadeLog,
  setCascadeLog,
  getCascadeLog,
  slowAnimationVars,
  SLOW_ANIM_FACTOR,
} from "./debug-options"
export { ViewTabBar, type ViewTabItem, type ViewTabLink } from "./view-tab-bar"
export { ButtonBar, type ButtonBarActions } from "./button-bar"
export { PopupMenu, type PopupMenuItem } from "./popup-menu"
export { FocusedTopicDetail, type FocusedTopicDetailItem } from "./focused-topic-detail"
export { ResourceCard } from "./resource-card"
export { SectionHeader } from "./section-header"
export { InfoPanel, INFO_PANEL_HEADER_HEIGHT, type InfoPanelProps } from "./info-panel"
export { StatCard, type StatCardProps, type StatCardStat } from "./stat-card"
export { StatList, StatListRow, type StatListProps, type StatListRowProps } from "./stat-list"
export { DeleteEntitySection, type DeleteEntitySectionProps } from "./delete-entity-section"
export { ListHeader, type ListHeaderProps, type ListHeaderSearch } from "./list-header"
export { ListWithDetailsPane, type ListWithDetailsPaneProps, type ListAction } from "./list-with-details-pane"
export { SendInvitationModal, type SendInvitationModalProps, type SendInvitationPayload } from "./send-invitation-modal"
export { AddUsersModal, type AddUsersModalProps, type DraftUser } from "./add-users-modal"
export { CreateResourceDialog, type CreateResourceDialogProps } from "./create-resource-dialog"
export {
  UserCard,
  UserCardSkeleton,
  PLATFORM_LABELS,
  type UserCardDto,
  type UserCardSocialLink,
  type UserCardAddress,
  type UserCardPersona,
} from "./user-card"
export { NotesAndHistory } from "./notes-and-history"
export { AdminNotesModal } from "./admin-notes-modal"
export {
  InvitationRequestsPane,
  InvitationPendingUsersPane,
  InvitationInvitesPane,
  type NotesSlots,
  type InvitationSendPayload,
} from "./invitation-panes"
