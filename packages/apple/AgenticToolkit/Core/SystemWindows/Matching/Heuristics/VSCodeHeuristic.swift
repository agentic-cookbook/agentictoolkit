import Foundation

/// Extracts the workspace/project name from VS Code window titles.
///
/// VS Code title format examples:
/// - "temporal — api.go"                      -> "temporal"
/// - "temporal — api.go — temporal"           -> "temporal"
/// - "myproject — src/main.ts"               -> "myproject"
/// - "Welcome — Visual Studio Code"           -> nil (not a project window)
/// - "settings.json — myproject"              -> "myproject"
///
/// VS Code uses an em-dash " — " (U+2014) as separator. When a workspace
/// is open, the workspace name appears as the first component. The pattern
/// extracts the first component before the em-dash.
public struct VSCodeHeuristic: AppHeuristic {
    public let name = "VS Code"
    public let appNames = ["Code", "Visual Studio Code", "Cursor"]

    public init() {}

    public func extractPattern(from title: String) -> String? {
        guard !title.isEmpty else { return nil }

        // Split on the title separator (em/en dash). Components are pre-trimmed.
        let components = HeuristicTitleParser.components(of: title)

        guard !components.isEmpty else { return nil }

        // Filter out generic VS Code titles
        let genericTitles: Set<String> = [
            "Visual Studio Code",
            "Welcome",
            "Get Started",
            "Settings"
        ]

        if components.count == 1 {
            // No separator: just the title
            let trimmed = components[0]
            if genericTitles.contains(trimmed) { return nil }
            return trimmed.isEmpty ? nil : trimmed
        }

        // Multiple components: the first is typically the workspace name.
        // However, if it looks like a filename (contains a dot extension),
        // check the last component for the workspace name instead.
        let first = components[0]
        let last = components[components.count - 1]

        // If the last component is a generic VS Code title, ignore it
        if genericTitles.contains(last) {
            return first.isEmpty ? nil : first
        }

        // If the first component looks like a filename (has a common extension),
        // prefer the last component as the workspace name
        if looksLikeFilename(first) && !looksLikeFilename(last) {
            return last.isEmpty ? nil : last
        }

        // Default: first component is the workspace/project name
        return first.isEmpty ? nil : first
    }

    /// Returns true if the string looks like a filename (contains a dot
    /// followed by a common file extension).
    private func looksLikeFilename(_ string: String) -> Bool {
        let components = string.split(separator: ".")
        guard components.count >= 2 else { return false }
        let ext = String(components.last!).lowercased()
        let commonExtensions: Set<String> = [
            "swift", "ts", "tsx", "js", "jsx", "go", "py", "rs", "rb",
            "java", "kt", "c", "cpp", "h", "hpp", "cs", "json", "yaml",
            "yml", "toml", "md", "txt", "html", "css", "scss", "vue",
            "svelte"
        ]
        return commonExtensions.contains(ext)
    }
}
