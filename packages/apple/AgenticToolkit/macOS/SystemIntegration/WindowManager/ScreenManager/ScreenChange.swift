import Foundation

/// Classification of a screen-parameters change, in increasing order of
/// disruption. Emitted by `ScreenManager` to its observers.
public enum ScreenChange: Equatable, Sendable {
    /// Same screens attached; at least one changed resolution (or its
    /// visible frame changed size, e.g. the Dock grew).
    case resolutionChanged
    /// Same screens at the same sizes; their relative positions in the
    /// global desktop space moved.
    case arrangementChanged
    /// The set of attached screens changed — a display was added or
    /// removed, or the user docked at a different location. When the new
    /// set was seen before, per-set window placements for it still apply.
    case screenSetChanged(previousSetID: String, currentSetID: String)
}
