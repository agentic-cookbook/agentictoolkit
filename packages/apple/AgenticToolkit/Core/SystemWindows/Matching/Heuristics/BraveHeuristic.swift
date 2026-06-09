import Foundation

/// Extracts the page title from Brave Browser window titles.
///
/// Brave title format examples:
/// - "Roadmap Dashboard - Brave"              -> "Roadmap Dashboard"
/// - "GitHub - Pull Requests - Brave"         -> "GitHub - Pull Requests"
/// - "New Tab - Brave"                        -> "New Tab"
/// - "Brave"                                  -> nil (no page title)
///
/// Brave appends " - Brave" to the active tab's page title.
/// The pattern is everything before the last " - Brave" suffix.
public struct BraveHeuristic: AppHeuristic {
    public let name = "Brave Browser"
    public let appNames = ["Brave Browser"]

    public init() {}

    public func extractPattern(from title: String) -> String? {
        guard !title.isEmpty else { return nil }

        let suffix = " - Brave"

        // If the title ends with " - Brave", strip it to get the page title
        if title.hasSuffix(suffix) {
            let pageTitle = String(title.dropLast(suffix.count))
                .trimmingCharacters(in: .whitespaces)
            return pageTitle.isEmpty ? nil : pageTitle
        }

        // If the title is just "Brave", there's no useful pattern
        if title.trimmingCharacters(in: .whitespaces) == "Brave" {
            return nil
        }

        // Fallback: return the whole title if it doesn't match the expected format
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : trimmed
    }
}
