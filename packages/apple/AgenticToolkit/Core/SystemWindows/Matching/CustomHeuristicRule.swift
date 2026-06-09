import Foundation
import os.log

/// How a custom heuristic rule matches against window titles.
public enum CustomMatchMode: String, Codable, Equatable, Sendable, CaseIterable {
    /// Match if the title contains the pattern as a substring (case-insensitive).
    case substring

    /// Match if the title matches the pattern as a regular expression.
    case regex

    /// Human-readable display name for each mode.
    public var displayName: String {
        switch self {
        case .substring: return "Substring"
        case .regex: return "Regex"
        }
    }
}

/// A user-defined heuristic rule for matching windows to contexts.
///
/// Custom rules complement the built-in heuristics (Xcode, Warp, Brave, etc.)
/// by allowing users to define their own app-specific title patterns. Each rule
/// specifies an app name, a title match pattern (substring or regex), and an
/// optional target context for auto-assignment.
public struct CustomHeuristicRule: Codable, Equatable, Identifiable, Sendable, Loggable {

    public static nonisolated let logger = makeLogger()

    /// Unique identifier for this rule.
    public let id: UUID

    /// The application name to match against (e.g., "Safari", "Firefox").
    /// Matched case-insensitively against the window's owning app name.
    public var appName: String

    /// The title pattern to extract or match (e.g., "JIRA-\\d+" for regex,
    /// or "Dashboard" for substring).
    public var titlePattern: String

    /// How to interpret the title pattern.
    public var matchMode: CustomMatchMode

    /// Whether this rule should auto-assign matching windows to the target context.
    /// When true and a new window matches, it is automatically added to the
    /// target context without user intervention.
    public var autoAssign: Bool

    /// Optional target context name for auto-assignment.
    /// When autoAssign is true and a window matches, this context is the target.
    /// If the context doesn't exist at match time, auto-assignment is skipped.
    public var targetContextName: String?

    /// Human-readable name for this rule (for display in Settings).
    public var name: String

    /// When this rule was created.
    public let createdAt: Date

    /// Creates a new custom heuristic rule.
    public init(
        id: UUID = UUID(),
        appName: String,
        titlePattern: String,
        matchMode: CustomMatchMode = .substring,
        autoAssign: Bool = false,
        targetContextName: String? = nil,
        name: String = "",
        createdAt: Date = Date()
    ) {
        self.id = id
        self.appName = appName
        self.titlePattern = titlePattern
        self.matchMode = matchMode
        self.autoAssign = autoAssign
        self.targetContextName = targetContextName
        self.name = name.isEmpty ? "\(appName) - \(titlePattern)" : name
        self.createdAt = createdAt
    }

    /// Tests whether a given window title matches this rule's pattern.
    ///
    /// - Parameter title: The window title to test.
    /// - Returns: The matched/extracted portion of the title, or nil if no match.
    public func matchTitle(_ title: String) -> String? {
        guard !titlePattern.isEmpty else { return nil }

        switch matchMode {
        case .substring:
            if title.localizedCaseInsensitiveContains(titlePattern) {
                return titlePattern
            }
            return nil

        case .regex:
            let regex: NSRegularExpression
            do {
                regex = try NSRegularExpression(pattern: titlePattern, options: [.caseInsensitive])
            } catch {
                let reason = error.localizedDescription
                Self.logger.error(
                    "Invalid custom-rule regex '\(titlePattern, privacy: .public)': \(reason, privacy: .public)"
                )
                return nil
            }

            let range = NSRange(title.startIndex..<title.endIndex, in: title)
            // Require a non-empty match: a zero-width pattern (e.g. `.*`, `^`) would
            // otherwise "match" every title and extract an empty pattern.
            // `Range(_:in:)` returns nil on a non-character boundary; bail vs trapping.
            guard let match = regex.firstMatch(in: title, options: [], range: range),
                  match.range.length > 0,
                  let matchRange = Range(match.range, in: title) else {
                return nil
            }
            return String(title[matchRange])
        }
    }
}
