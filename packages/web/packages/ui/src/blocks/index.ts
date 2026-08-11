export { AppTabs, type AppTab } from "./app-tabs"
export { EditorSection, type EditorSectionItem } from "./editor-section"
export { MarkdownEditor, type MarkdownEditorProps } from "./markdown-editor"
export { Field } from "./field"
export { FieldGroup } from "./field-group"
// The tag-set row (autocomplete + browse/add chooser + chips) — one affordance for every
// surface that edits a set of labels, so research tags and work-item labels behave alike.
export { TagSetField } from "./tag-set-field"
// Its sibling for the single-valued, HIERARCHICAL vocabulary: same autocomplete + browse pair,
// plus the breadcrumb that says where in the tree the chosen name sits and the rename behind it.
export { CategoryField, categoryTrail, type CategoryTreeNode } from "./category-field"
export { TopicDetail, type TopicDetailItem, type RailSlot } from "./topic-detail"
// How to name the detail pane the user is actually looking at, rather than HTDV's outgoing
// crossfade snapshot of the previous one. Re-exported here for app code that already imports from
// `blocks`; a Playwright spec should take the React-free `@agentic-toolkit/ui/lib/detail-pane`
// subpath instead (the snapshot is hidden from the accessibility tree, not from the DOM).
export { DETAIL_PANE_ATTR, LIVE_DETAIL_PANE } from "../lib/detail-pane"
// TopicSelectHint is THE "select something" placeholder card — every pane that waits on a
// choice renders it (the stack frontier does so automatically); EmptyState stays the home
// for genuinely empty/loading/error panes.
export { TopicOverview, TopicSelectHint } from "./topic-overview"
export {
  HierarchicalTopicDetail,
  type TopicLevel,
  type PaneExitGuard,
  type TopicSelectOptions,
} from "./hierarchical-topic-detail"
export { deepestSelectedLevel } from "./stack-frontier"
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
// The HTDV layout log: host-flipped tracing of the wide/narrow decision and the stacks' fit passes
// (the adh shell turns it on everywhere except production). See htdv-log.ts.
export { setHtdvLayoutLog, getHtdvLayoutLog } from "./htdv-log"
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
// HDV — Hierarchical Document View: the long-form document reader (nav tree,
// breadcrumbs, prose, frontmatter, scrollspy ToC). Router-agnostic by design; a
// host injects `LinkComponent` and passes a plain `activePath`. `doc-types.ts` is
// a `.ts` file, so this barrel is its ONLY public import path — the `./blocks/*`
// wildcard resolves `.tsx` only.
export type {
  DocCrumb,
  DocLinkComponent,
  DocMetadataField,
  DocNavTopLink,
  HdvNavNode,
  HeadingEntry,
} from "./doc-types"
export { DefaultDocLink, type DefaultDocLinkProps } from "./doc-link"
export {
  DocNav,
  DocNavTree,
  DOC_NAV_ASIDE_CLASS,
  DOC_NAV_NAV_CLASS,
  DOC_NAV_DESKTOP_NAV_CLASS,
  DOC_NAV_OVERLAY_CLASS,
  DOC_NAV_SCRIM_CLASS,
  DOC_NAV_DRAWER_CLASS,
  DOC_NAV_SECTION_LABEL_CLASS,
  DOC_NAV_TOP_LINK_CLASS,
  DOC_NAV_SECTION_LIST_CLASS,
  DOC_NAV_BRANCH_LIST_CLASS,
  type DocNavProps,
  type DocNavTreeProps,
} from "./doc-nav"
export { DocBreadcrumbs, type DocBreadcrumbsProps } from "./doc-breadcrumbs"
export { DocMetadata, type DocMetadataProps } from "./doc-metadata"
export {
  DocArticle,
  DOC_ARTICLE_PROSE_CLASS,
  type DocArticleProps,
} from "./doc-article"
export {
  DocTableOfContents,
  DOC_TABLE_OF_CONTENTS_CLASS,
  type DocTableOfContentsProps,
} from "./doc-table-of-contents"
export {
  HierarchicalDocumentView,
  DocPage,
  HIERARCHICAL_DOCUMENT_VIEW_CLASS,
  HIERARCHICAL_DOCUMENT_VIEW_CONTENT_CLASS,
  DOC_PAGE_CLASS,
  DOC_PAGE_ARTICLE_CLASS,
  type HierarchicalDocumentViewProps,
  type DocPageProps,
} from "./hierarchical-document-view"
export {
  ViewSourceDisclosure,
  VIEW_SOURCE_DISCLOSURE_CLASS,
  VIEW_SOURCE_TRIGGER_CLASS,
  VIEW_SOURCE_PRE_CLASS,
  type ViewSourceDisclosureProps,
} from "./view-source-disclosure"
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
export { TransferOwnershipSection, type TransferOwnershipSectionProps, type TransferTarget, type TransferPreviewResult } from "./transfer-ownership-section"
export { ListHeader, type ListHeaderProps, type ListHeaderSearch } from "./list-header"
export { ListWithDetailsPane, type ListWithDetailsPaneProps, type ListAction } from "./list-with-details-pane"
export { SelectionActions, type SelectionActionsProps } from "./selection-actions"
export { SendInvitationModal, type SendInvitationModalProps, type SendInvitationPayload } from "./send-invitation-modal"
export { AddUsersModal, type AddUsersModalProps, type DraftUser } from "./add-users-modal"
export { CreateResourceDialog, type CreateResourceDialogProps } from "./create-resource-dialog"
// The command palette (⌘K) — the one surface that finds a thing by NAME rather than by place. It
// renders the groups it is handed and filters nothing; `filterCommandItems` is the shared definition
// of "matches", for a host narrowing its own static commands. Pairs with `hooks/useShortcut`.
export {
  CommandPalette,
  filterCommandItems,
  type CommandPaletteProps,
  type CommandGroup,
  type CommandItem,
} from "./command-palette"
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
