import Foundation

/// Strategy used to match a window fingerprint against live windows.
///
/// When re-matching windows after a restart, the match strategy determines
/// how strictly the fingerprint must match a candidate window.
public enum MatchStrategy: String, Codable, Equatable, Sendable, CaseIterable {
    /// Match by app name and exact title match.
    case appAndTitleExact

    /// Match by app name and title substring containment.
    case appAndTitleSubstring

    /// Match by app name and a regular-expression test against the live title.
    /// The fingerprint's `titlePattern` holds the regex source (not a captured
    /// value), so every title in the same family re-matches after restart.
    case appAndTitleRegex

    /// Match by app name only (ignores title).
    case appOnly
}
