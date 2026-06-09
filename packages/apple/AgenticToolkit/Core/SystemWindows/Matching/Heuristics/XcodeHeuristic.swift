import Foundation

/// Extracts the project name from Xcode window titles.
///
/// Xcode title format examples:
/// - "QualityTime — ContentView.swift"       -> "QualityTime"
/// - "QualityTime — ContentView.swift (Edited)" -> "QualityTime"
/// - "MyApp"                                  -> "MyApp"
/// - "MyApp — MyApp.xcodeproj"               -> "MyApp"
///
/// The project name is the portion before the em-dash separator " — ".
/// If there is no separator, the entire title is treated as the project name.
public struct XcodeHeuristic: AppHeuristic {
    public let name = "Xcode"
    public let appNames = ["Xcode"]

    public init() {}

    public func extractPattern(from title: String) -> String? {
        guard !title.isEmpty else { return nil }

        // Xcode separates the project name from the file name with a dash. Take the
        // first component (the project name); with no separator the whole title is it
        // (e.g. organizer window).
        let projectName = HeuristicTitleParser.components(of: title).first ?? ""
        return projectName.isEmpty ? nil : projectName
    }
}
