import Foundation

/// Top-level persisted state for the system-window context system.
///
/// Captures which context is active and the ordered list of context IDs.
/// Application-specific settings are intentionally NOT part of this model —
/// hosts persist their own settings separately (e.g. via UserSettings).
public struct SystemWindowContextsState: Codable, Equatable, Sendable {
    /// The ID of the currently active context, or nil if none is active.
    public var activeContextID: UUID?

    /// Ordered list of context IDs. Determines display order in menus and
    /// keyboard shortcut numbering (index 0 = shortcut 1, etc.).
    public var contextIDs: [UUID]

    /// Creates a default empty state.
    public init(
        activeContextID: UUID? = nil,
        contextIDs: [UUID] = []
    ) {
        self.activeContextID = activeContextID
        self.contextIDs = contextIDs
    }
}
