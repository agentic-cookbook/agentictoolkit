import Foundation

/// Represents a single unmatched fingerprint displayed in a Reconcile UI.
///
/// After a relaunch the engine re-matches persisted window fingerprints against
/// the live window list. Anything it can't auto-assign with confidence becomes a
/// `ReconcileItem` so the UI can ask the user to assign it (or skip it).
public struct ReconcileItem: Identifiable, Equatable {
    /// Unique ID for this reconcile item (matches the snapshot ID).
    public let id: UUID

    /// The context this snapshot belongs to.
    public let contextID: UUID

    /// The context's display name.
    public let contextName: String

    /// The context's color hex string.
    public let contextColor: String

    /// The app that owns this fingerprint.
    public let app: String

    /// The title pattern from the fingerprint.
    public let titlePattern: String

    /// Candidate windows that could match this fingerprint, sorted by score descending.
    public let candidates: [ReconcileCandidate]

    public init(
        id: UUID,
        contextID: UUID,
        contextName: String,
        contextColor: String,
        app: String,
        titlePattern: String,
        candidates: [ReconcileCandidate]
    ) {
        self.id = id
        self.contextID = contextID
        self.contextName = contextName
        self.contextColor = contextColor
        self.app = app
        self.titlePattern = titlePattern
        self.candidates = candidates
    }
}

/// A candidate window that could be assigned to an unmatched fingerprint.
public struct ReconcileCandidate: Identifiable, Equatable {
    /// Unique ID for this candidate (derived from the window ID).
    public var id: UInt32 { windowID }

    /// The CGWindowID of the candidate window.
    public let windowID: UInt32

    /// The app name of the candidate window.
    public let app: String

    /// The title of the candidate window.
    public let windowTitle: String

    /// The match score against the fingerprint.
    public let score: Int

    public init(windowID: UInt32, app: String, windowTitle: String, score: Int) {
        self.windowID = windowID
        self.app = app
        self.windowTitle = windowTitle
        self.score = score
    }
}
