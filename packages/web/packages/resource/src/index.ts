// @agentic-toolkit/resource — the generic resource-browsing UI.
//
// A ResourceExplorer<T> orchestrates a selectable-resource feature (a resource
// list ▸ its topics ▸ each topic's pane) as one hierarchical topic/detail. It runs
// in two modes: standalone (renders its own HierarchicalTopicDetail — what feature
// sites use) or, inside a rail HOST (the hub's one-rail workspace shell), it
// PUBLISHES its levels/guards into the host's one merged stack. The host seam is
// the rail-host contract here; the record-affordance seam lets a host inject a
// per-record control (e.g. an api-explorer button) that standalone sites omit.

// The resource orchestrator + its config types.
export { ResourceExplorer } from "./resource-explorer";
export type { ResourceTopic, TopicLeaf, ResourceLandingConfig } from "./resource-explorer";
// Re-exported (it is declared with the stack, in @agentic-toolkit/ui) because it is part of
// TopicLeaf's OWN signature: a consumer implementing a leaf here shouldn't have to reach into
// another package to name the argument the stack hands it.
export type { TopicSelectOptions } from "@agentic-toolkit/ui/blocks";

// The host-or-standalone boundary every feature ENTRY wraps its published content in:
// pass-through under an existing rail host (the hub shell), a self-hosted rail + exit
// guards on a bare feature site. ResourceExplorer routes through it internally; the
// publisher-only feature entries (research/dashboards/knowledgebases/personas) wrap
// explicitly — without it their rails/guards silently no-op standalone. The raw
// StandaloneRailHost stays package-private: an UNCONDITIONAL wrap inside the hub shell
// shadows the workspace registry (see its doc), so the safe boundary is the only entry.
export { RailHostBoundary } from "./standalone-rail-host";

// The "All" card/list landing, the "New …" dialog, and the single-record settings pane.
export { ResourceLanding } from "./resource-landing";
export { CreateResourceDialog } from "./create-resource-dialog";
export { RecordSettingsPane } from "./record-settings-pane";

// The rail-host contract + the publisher hooks a feature uses to feed a host's stack.
export {
  RailHostContext,
  useRailHost,
  StackLevels,
  useStackLevel,
  useRailExitGuard,
  ToolbarPortal,
  useToolbarPortal,
} from "./rail-host";
export type { RailHostRegistry, RegisteredLevels, PaneExitGuard } from "./rail-host";

// The record-affordance seam: a host-injected per-record renderer (null standalone).
export { RecordAffordanceContext, useRecordAffordance } from "./record-affordance";
export type { RecordAffordanceProps, RecordAffordanceRenderer } from "./record-affordance";

// A grouping rail level whose members render as the deeper content of the ONE
// merged stack (navigation groups and tabbed editors alike).
export { StackGroupDetail } from "./group-topic-detail";
export type { GroupTopicItem } from "./group-topic-detail";

// URL push helpers for a feature mounted at an explicit basePath (the port of
// the hub's useFeatureRoute with the base made a parameter).
export { useBasePathRoute } from "./use-base-path-route";

// The "?" help affordance the button bars below use. Exported because a HOST
// renders the same affordance in its own chrome (the hub's workspace header,
// its settings panes) and must get the identical popover, not a second copy of
// it — a byte-identical fork of this file lived in the hub until it did.
export { HelpPopover } from "./HelpPopover";

// The master/detail substrate: the two-pane layout + its parts, the leaf editor, the
// list-as-rail-level bridge, and the editing state machine.
export {
  MasterDetailLayout,
  FeatureTitle,
  ButtonBar,
  DetailSection,
  DetailFooter,
} from "./master-detail/MasterDetailLayout";
export type { MasterDetailItem, MasterDetailActions } from "./master-detail/MasterDetailLayout";
export { SaveCancelButtons } from "./master-detail/SaveCancelButtons";
export { MasterDetailLeaf } from "./master-detail/MasterDetailLeaf";
export { useMasterDetailLevel } from "./master-detail/useMasterDetailLevel";
export { useMasterDetailForm } from "./master-detail/useMasterDetailForm";
export type { MasterDetailForm, MasterDetailFormConfig } from "./master-detail/useMasterDetailForm";
