import Foundation

/// Extracts a pattern from macOS Terminal window titles.
///
/// Terminal title format examples:
/// - "mfullerton — -zsh — 80x24"             -> "zsh"
/// - "mfullerton — -bash — 120x40"           -> "bash"
/// - "mfullerton — vim — 80x24"              -> "vim"
/// - "mfullerton — ssh user@host"             -> "ssh user@host"
/// - "zsh"                                    -> "zsh"
/// - "bash"                                   -> "bash"
///
/// Terminal titles typically follow: "user — process — dimensions"
/// The middle component (process/command) is the most identifying.
/// For basic shells (zsh, bash), the match strategy should be appOnly
/// since shell titles are not distinctive enough.
public struct TerminalHeuristic: AppHeuristic {
    public let name = "Terminal"
    public let appNames = ["Terminal"]

    public init() {}

    /// Terminal windows running plain shells are not very distinctive,
    /// so appOnly is the safest default.
    public var recommendedStrategy: MatchStrategy {
        .appOnly
    }

    public func extractPattern(from title: String) -> String? {
        guard !title.isEmpty else { return nil }

        let components = HeuristicTitleParser.components(of: title)

        if components.count >= 2 {
            // Take the second component (the process/command)
            var process = components[1]

            // Terminal prefixes shell names with a dash: "-zsh", "-bash"
            if process.hasPrefix("-") {
                process = String(process.dropFirst())
            }

            return process.isEmpty ? nil : process
        }

        // Single component: might just be "zsh" or "bash"
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : trimmed
    }
}
