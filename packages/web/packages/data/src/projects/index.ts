// Public surface of the Projects data domain — the API clients, their entity
// types, and the `toX` row mappers.
// The board-column vocabulary. Public because it is a closed set a consumer must be able to
// switch on exhaustively — reaching it as `ProjectStatus["category"]` works but cannot be named
// in a signature that does not already hold a status.
export type { StatusCategory } from "./wire";
// Likewise the link vocabulary: a consumer switching on how two cards are related needs to name
// the set in a signature, not only reach it through a relation it already holds.
export type { RelationKind } from "./wire";
// And the shape a reorder names its destination with. Public because a UI hands a move DOWNWARD
// through props — a row's "move up" button raises `(id, target)` to whoever owns the list — and
// those signatures need to name the target without already holding one.
export type { WorkItemMoveTarget } from "./wire";
// The two estimate/iteration vocabularies, public for the same reason as the categories above:
// both are closed sets a renderer switches on exhaustively — which numbers a picker offers, and
// how a box's badge reads — and a signature that takes one rarely already holds a project.
export type { EstimateScale, IterationState } from "./wire";
// A project's reported health, and the per-category tally a milestone reports its progress as.
// Public for the same reason: both are closed shapes a renderer switches on or indexes into, and
// a signature that takes one (a badge's tone, a progress bar's props) rarely already holds the
// project or milestone it came off.
export type { ProjectHealth, MilestoneCounts } from "./wire";
// What a template MAKES, and the two body shapes read against it. Public for the same reason as
// the vocabularies above — an editor takes a body without holding the template it belongs to, and
// a picker names the kind it wants before any row exists to reach it through.
export type {
  TemplateKind,
  TemplateCardSpec,
  WorkItemTemplateBody,
  ProjectTemplateBody,
  TemplatePatchBody,
  TemplateInstantiateWorkItemBody,
} from "./wire";
// The placement a triage acceptance carries. Public because the decision is raised UPWARD from a
// queue row to whoever owns the list, exactly as a move target is.
export type { TriageAcceptBody } from "./wire";
export * from "./projects";
export * from "./iterations";
export * from "./programs";
export * from "./milestones";
export * from "./status-updates";
export * from "./work-items";
export * from "./templates";
export * from "./triage";
export * from "./search";
export * from "./activity";
export * from "./comments";
export * from "./artifacts";
