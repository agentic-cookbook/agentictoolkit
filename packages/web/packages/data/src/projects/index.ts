// Public surface of the Projects data domain — the three API clients, their
// entity types, and the `toX` row mappers.
// The board-column vocabulary. Public because it is a closed set a consumer must be able to
// switch on exhaustively — reaching it as `ProjectStatus["category"]` works but cannot be named
// in a signature that does not already hold a status.
export type { StatusCategory } from "./wire";
export * from "./projects";
export * from "./work-items";
export * from "./activity";
export * from "./artifacts";
