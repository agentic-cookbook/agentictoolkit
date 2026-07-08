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
