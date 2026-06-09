import Foundation

/// A heuristic that extracts a meaningful pattern from a window title
/// for a specific application.
///
/// Each app has its own title format. For example, Xcode uses
/// "ProjectName — FileName.swift" while Brave uses "Page Title - Brave".
/// Heuristics parse these formats to extract the stable, identifying
/// portion (e.g., the project name, page title) for fingerprinting.
public protocol AppHeuristic: Sendable {
    /// The user-visible name for this heuristic (e.g., "Xcode").
    var name: String { get }

    /// The app names this heuristic applies to.
    ///
    /// These are matched against the ownerName from CGWindowListCopyWindowInfo
    /// (e.g., "Xcode", "Brave Browser", "Code").
    var appNames: [String] { get }

    /// Extracts a stable identifying pattern from a window title.
    ///
    /// Returns nil if the title does not match the expected format,
    /// meaning the heuristic cannot extract a useful pattern.
    ///
    /// - Parameter title: The raw window title string.
    /// - Returns: The extracted pattern, or nil if extraction fails.
    func extractPattern(from title: String) -> String?

    /// The recommended match strategy for fingerprints created by this heuristic.
    var recommendedStrategy: MatchStrategy { get }

    /// Produces the pattern and match strategy to store in a fingerprint for the
    /// given title, or nil if no useful pattern can be extracted.
    ///
    /// The default derives `(extractPattern(from:), recommendedStrategy)`. Heuristics
    /// whose stored pattern must differ from the extracted value (e.g. a regex rule,
    /// which stores the regex source so a whole family of titles re-matches) override
    /// this.
    func fingerprintPattern(for title: String) -> (pattern: String, strategy: MatchStrategy)?
}

/// Default implementations.
public extension AppHeuristic {
    var recommendedStrategy: MatchStrategy {
        .appAndTitleSubstring
    }

    func fingerprintPattern(for title: String) -> (pattern: String, strategy: MatchStrategy)? {
        guard let pattern = extractPattern(from: title) else { return nil }
        return (pattern, recommendedStrategy)
    }
}

/// Shared parsing helpers for the built-in title heuristics.
///
/// Centralizes the separator handling so every editor/terminal heuristic agrees on
/// which characters delimit the project/document components and so a fix (e.g. adding
/// a new separator variant) lands in one place.
public enum HeuristicTitleParser {
    /// Separators macOS apps place between title components, most specific first.
    /// Apps render an em dash (U+2014); a few locales/builds use an en dash (U+2013).
    public static let separators = [" \u{2014} ", " \u{2013} "]

    /// Splits `title` on the first recognized separator and trims each component.
    /// Returns a single trimmed element when no separator is present.
    public static func components(of title: String) -> [String] {
        for separator in separators where title.contains(separator) {
            return title.components(separatedBy: separator)
                .map { $0.trimmingCharacters(in: .whitespaces) }
        }
        return [title.trimmingCharacters(in: .whitespaces)]
    }
}
