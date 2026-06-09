import Foundation

/// An AppHeuristic that wraps a user-defined CustomHeuristicRule.
///
/// This bridges user-created rules into the heuristic system so they
/// participate in fingerprinting and window re-matching alongside the
/// built-in heuristics (Xcode, Warp, Brave, etc.).
public struct CustomHeuristic: AppHeuristic {
    /// The underlying user-defined rule.
    public let rule: CustomHeuristicRule

    public init(rule: CustomHeuristicRule) {
        self.rule = rule
    }

    /// The display name is the rule's name.
    public var name: String { rule.name }

    /// The app names this heuristic applies to.
    public var appNames: [String] { [rule.appName] }

    /// Extracts a pattern from the title using the rule's match mode.
    ///
    /// For substring rules, the pattern itself is returned if the title contains it.
    /// For regex rules, the first match in the title is returned.
    public func extractPattern(from title: String) -> String? {
        rule.matchTitle(title)
    }

    public var recommendedStrategy: MatchStrategy {
        rule.matchMode == .regex ? .appAndTitleRegex : .appAndTitleSubstring
    }

    /// Substring rules fingerprint by the captured substring (matched by containment).
    /// Regex rules must fingerprint by the regex SOURCE with `.appAndTitleRegex`, so the
    /// whole family of matching titles re-matches after restart — comparing one window's
    /// captured value against a sibling's (e.g. "JIRA-1234" vs "JIRA-9999") would never
    /// match.
    public func fingerprintPattern(for title: String) -> (pattern: String, strategy: MatchStrategy)? {
        // Only fingerprint titles the rule actually matches.
        guard extractPattern(from: title) != nil else { return nil }
        switch rule.matchMode {
        case .substring:
            return (rule.titlePattern, .appAndTitleSubstring)
        case .regex:
            return (rule.titlePattern, .appAndTitleRegex)
        }
    }
}
