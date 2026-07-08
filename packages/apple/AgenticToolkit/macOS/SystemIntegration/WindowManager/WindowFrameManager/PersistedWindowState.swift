import CoreGraphics
import Foundation

/// One saved window position + size within a specific screen set.
///
/// The anchor is the window's *top-left* corner (the user's point of view:
/// x grows rightward, y grows **downward** from the top of the screen's
/// visible area), stored as an absolute offset from the target screen's
/// visible-frame top-left. Restoring in the same screen set replays that
/// exact offset — no proportional math, so content-driven resizes can
/// never walk the window between launches.
///
/// `relativeX`/`relativeY` additionally record where the window sits as a
/// fraction of its available travel (0 = flush left/top, 1 = flush
/// right/bottom, 0.5 = centered). They are only consulted when the saved
/// geometry no longer applies literally: a resolution change, or falling
/// back to the main screen in a screen set the window has never been
/// placed in.
public struct WindowPlacement: Codable, Equatable, Sendable {
    /// Which screen of the set the window was on.
    public let screenFingerprint: ScreenFingerprint
    /// Top-left offset from the screen's visible-frame top-left, points right.
    public let topLeftX: CGFloat
    /// Top-left offset from the screen's visible-frame top-left, points DOWN.
    public let topLeftY: CGFloat
    public let width: CGFloat
    public let height: CGFloat
    /// 0...1 fraction of horizontal travel (0 = left edge, 1 = right edge).
    public let relativeX: CGFloat
    /// 0...1 fraction of vertical travel (0 = top edge, 1 = bottom edge).
    public let relativeY: CGFloat
    public let savedAt: Date

    public init(
        screenFingerprint: ScreenFingerprint,
        topLeftX: CGFloat,
        topLeftY: CGFloat,
        width: CGFloat,
        height: CGFloat,
        relativeX: CGFloat,
        relativeY: CGFloat,
        savedAt: Date
    ) {
        self.screenFingerprint = screenFingerprint
        self.topLeftX = topLeftX
        self.topLeftY = topLeftY
        self.width = width
        self.height = height
        self.relativeX = relativeX
        self.relativeY = relativeY
        self.savedAt = savedAt
    }
}

/// The saved state for a window, stored as JSON: one `WindowPlacement` per
/// screen set (keyed by `ScreenSet.id`), so a window remembers a distinct
/// position at every location the machine docks at.
///
/// Decoding also accepts the v1 single-placement format (proportional
/// origin + screen fingerprint); a decoded v1 blob surfaces as `legacy`
/// and is migrated to a placement on the first restore.
public struct PersistedWindowState: Codable, Sendable {
    public var placements: [String: WindowPlacement]
    /// Populated only when a v1 blob was decoded; never re-encoded.
    public let legacy: LegacyPersistedWindowState?

    public init(placements: [String: WindowPlacement]) {
        self.placements = placements
        self.legacy = nil
    }

    private enum CodingKeys: String, CodingKey {
        case placements
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let placements = try container.decodeIfPresent([String: WindowPlacement].self, forKey: .placements) {
            self.placements = placements
            self.legacy = nil
        } else if let legacy = try? LegacyPersistedWindowState(from: decoder) {
            // A genuine v1 blob (proportional origin + fingerprint).
            self.placements = [:]
            self.legacy = legacy
        } else {
            // Neither a v2 `placements` key nor a decodable v1 record — e.g.
            // `{}`, `{"placements": null}`, or an externally corrupted blob.
            // Degrade to empty state rather than throwing, so every decode
            // call site (not just the `try?`-wrapped storage backends) starts
            // fresh instead of failing.
            self.placements = [:]
            self.legacy = nil
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(placements, forKey: .placements)
    }
}

/// The v1 on-disk format: a single proportional position (origin as a
/// fraction of the travel range, bottom-left anchored) plus the screen it
/// was saved on. Kept only to migrate existing saved state.
public struct LegacyPersistedWindowState: Codable, Sendable {
    public let proportionalX: CGFloat
    public let proportionalY: CGFloat
    public let width: CGFloat
    public let height: CGFloat
    public let screenFingerprint: ScreenFingerprint
    public let savedAt: Date

    public init(
        proportionalX: CGFloat,
        proportionalY: CGFloat,
        width: CGFloat,
        height: CGFloat,
        screenFingerprint: ScreenFingerprint,
        savedAt: Date
    ) {
        self.proportionalX = proportionalX
        self.proportionalY = proportionalY
        self.width = width
        self.height = height
        self.screenFingerprint = screenFingerprint
        self.savedAt = savedAt
    }
}
