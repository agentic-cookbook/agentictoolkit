import Foundation

/// Extracts the project/directory name from Warp terminal window titles.
///
/// Warp title format examples:
/// - "Claude - QualityTime (main) *"           -> "QualityTime"
/// - "mike - hairball (feature/v1) *"          -> "hairball"
/// - "mike - Documents"                        -> "Documents"
/// - "Claude - ~/projects/myapp (develop)"     -> "myapp"
///
/// Warp titles typically follow: "user - directory (branch) [*]"
/// The directory/project name is between the first " - " and either
/// a " (" (branch indicator) or end of string.
public struct WarpHeuristic: AppHeuristic {
    public let name = "Warp"
    public let appNames = ["Warp"]

    public init() {}

    public func extractPattern(from title: String) -> String? {
        guard !title.isEmpty else { return nil }

        // Find the first " - " separator (user/session - path)
        guard let dashRange = title.range(of: " - ") else {
            return nil
        }

        // Everything after " - " is the path/branch portion
        var remainder = String(title[dashRange.upperBound...])
            .trimmingCharacters(in: .whitespaces)

        // Remove trailing dirty indicator " *"
        if remainder.hasSuffix(" *") {
            remainder = String(remainder.dropLast(2))
        }

        // Remove branch portion in parentheses " (branch)"
        if let parenRange = remainder.range(of: " (") {
            remainder = String(remainder[remainder.startIndex..<parenRange.lowerBound])
        }

        remainder = remainder.trimmingCharacters(in: .whitespaces)

        // If it looks like a path (contains /), take the last component. A bare root
        // path ("/") splits into no components, so there is no useful pattern.
        if remainder.contains("/") {
            let last = remainder.split(separator: "/").last
                .map { String($0).trimmingCharacters(in: .whitespaces) }
            return (last?.isEmpty == false) ? last : nil
        }

        return remainder.isEmpty ? nil : remainder
    }
}
