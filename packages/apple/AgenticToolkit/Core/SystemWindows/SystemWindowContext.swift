import CoreGraphics
import Foundation

/// A named group of windows that the user works with together.
///
/// A context represents a logical workspace — for example, "iOS App",
/// "Backend API", or "Docs". Each context owns a set of window snapshots.
/// When the user switches to a context, its windows are restored to their
/// saved positions and all other contexts' windows are parked off-screen.
public struct SystemWindowContext: Codable, Identifiable, Equatable, Sendable {
    /// Unique identifier for this context.
    public let id: UUID

    /// User-visible name (e.g., "iOS App", "Backend API").
    public var name: String

    /// Color displayed in the menu bar and context list, as a hex string
    /// (e.g., "#FF5733"). Includes the leading "#".
    public var color: String

    /// Snapshots of all windows assigned to this context.
    public var windowSnapshots: [SystemWindowSnapshot]

    /// The snapshot ID of the last-focused window in this context.
    /// Used to restore focus when switching back to this context.
    public var lastFocusedWindowID: UUID?

    /// When this context was created.
    public let createdAt: Date

    /// Creates a new context with a generated UUID and current timestamp.
    public init(
        id: UUID = UUID(),
        name: String,
        color: String = "#007AFF",
        windowSnapshots: [SystemWindowSnapshot] = [],
        lastFocusedWindowID: UUID? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.color = color
        self.windowSnapshots = windowSnapshots
        self.lastFocusedWindowID = lastFocusedWindowID
        self.createdAt = createdAt
    }

    // MARK: - Window Snapshot Management

    /// Adds a window snapshot to this context.
    ///
    /// If a snapshot with the same ID already exists, it is replaced.
    public mutating func addWindow(_ snapshot: SystemWindowSnapshot) {
        if let index = windowSnapshots.firstIndex(where: { $0.id == snapshot.id }) {
            windowSnapshots[index] = snapshot
        } else {
            windowSnapshots.append(snapshot)
        }
    }

    /// Removes the window snapshot with the given ID.
    ///
    /// - Returns: The removed snapshot, or nil if no snapshot with that ID exists.
    @discardableResult
    public mutating func removeWindow(id: UUID) -> SystemWindowSnapshot? {
        guard let index = windowSnapshots.firstIndex(where: { $0.id == id }) else {
            return nil
        }
        let removed = windowSnapshots.remove(at: index)

        // Clear lastFocusedWindowID if it was the removed window
        if lastFocusedWindowID == id {
            lastFocusedWindowID = nil
        }

        return removed
    }

    /// Removes the window snapshot matching the given CGWindowID.
    ///
    /// - Returns: The removed snapshot, or nil if no snapshot has that window ID.
    @discardableResult
    public mutating func removeWindow(windowID: UInt32) -> SystemWindowSnapshot? {
        guard let index = windowSnapshots.firstIndex(where: { $0.windowID == windowID }) else {
            return nil
        }
        let removed = windowSnapshots.remove(at: index)

        if lastFocusedWindowID == removed.id {
            lastFocusedWindowID = nil
        }

        return removed
    }

    /// Returns the snapshot with the given UUID, if one exists.
    public func snapshot(id: UUID) -> SystemWindowSnapshot? {
        windowSnapshots.first(where: { $0.id == id })
    }

    /// Mutates the snapshot with the given stable ID in place, if present.
    ///
    /// - Returns: true if a snapshot was found and updated.
    @discardableResult
    public mutating func updateSnapshot(
        id: UUID,
        _ body: (inout SystemWindowSnapshot) -> Void
    ) -> Bool {
        guard let index = windowSnapshots.firstIndex(where: { $0.id == id }) else { return false }
        body(&windowSnapshots[index])
        return true
    }

    /// Mutates the snapshot matching the given live CGWindowID in place, if present.
    ///
    /// - Returns: true if a snapshot was found and updated.
    @discardableResult
    public mutating func updateSnapshot(
        windowID: UInt32,
        _ body: (inout SystemWindowSnapshot) -> Void
    ) -> Bool {
        guard let index = windowSnapshots.firstIndex(where: { $0.windowID == windowID }) else {
            return false
        }
        body(&windowSnapshots[index])
        return true
    }

    /// The number of live (non-dormant) windows in this context.
    public var liveWindowCount: Int {
        windowSnapshots.filter(\.isLive).count
    }
}
