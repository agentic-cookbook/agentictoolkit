import AgenticToolkitCore
import AppKit
import Combine
import Foundation
import os

/// The type of IDE or development tool detected in a project directory.
///
/// Each case maps to a well-known project marker file or directory.
/// Provides display names and SF Symbol icons for UI presentation.
public enum IDEType: String, Codable, Equatable, Hashable, CaseIterable, Sendable {
    case xcode
    case xcodeWorkspace
    case swiftPackage
    case vscode
    case intellij
    case androidStudio

    /// Human-readable display name for this IDE type.
    public var displayName: String {
        switch self {
        case .xcode: return "Xcode"
        case .xcodeWorkspace: return "Xcode Workspace"
        case .swiftPackage: return "Swift Package"
        case .vscode: return "VS Code"
        case .intellij: return "IntelliJ IDEA"
        case .androidStudio: return "Android Studio"
        }
    }

    /// SF Symbol name for this IDE type.
    public var systemImageName: String {
        switch self {
        case .xcode: return "hammer.fill"
        case .xcodeWorkspace: return "hammer"
        case .swiftPackage: return "shippingbox"
        case .vscode: return "chevron.left.forwardslash.chevron.right"
        case .intellij: return "lightbulb.fill"
        case .androidStudio: return "apps.iphone"
        }
    }

    /// The macOS application bundle identifier used to open this IDE.
    /// Returns `nil` for types that don't have a dedicated app.
    public var bundleIdentifier: String? {
        switch self {
        case .xcode, .xcodeWorkspace, .swiftPackage: return "com.apple.dt.Xcode"
        case .vscode: return "com.microsoft.VSCode"
        case .intellij: return "com.jetbrains.intellij"
        case .androidStudio: return "com.google.android.studio"
        }
    }
}

/// A detected IDE project within a project directory.
public struct IDEProject: Codable, Equatable, Hashable, Identifiable, Sendable {
    /// Unique identifier combining type and path for stable identity.
    public var id: String { "\(type.rawValue):\(path)" }

    /// The type of IDE this project belongs to.
    public let type: IDEType

    /// The relative path from the project root to the IDE marker file/directory.
    public let path: String

    /// A human-readable display name derived from the marker filename.
    public let displayName: String

    public init(type: IDEType, path: String, displayName: String) {
        self.type = type
        self.path = path
        self.displayName = displayName
    }
}

/// Scans a project root directory for IDE project markers and caches results.
///
/// Detection is asynchronous and runs on a background queue. Results are published
/// on the main actor for UI consumption. Scanning is limited to the top-level
/// directory and one level deep to avoid expensive deep traversals.
///
/// Supported markers:
/// - `.xcodeproj` directories
/// - `.xcworkspace` directories
/// - `Package.swift` files
/// - `.vscode/` directories
/// - `.idea/` directories
@MainActor
public final class IDEDetector: ObservableObject {
    /// The detected IDE projects, sorted by display name.
    @Published public var detectedIDEs: [IDEProject] = []

    /// Whether a detection scan is currently in progress.
    @Published public var isDetecting: Bool = false

    private let rootURL: URL

    public init(rootURL: URL) {
        self.rootURL = rootURL
    }

    /// Opens the given IDE project in its associated application.
    public static func open(project: IDEProject, rootURL: URL) {
        let targetURL = rootURL.appendingPathComponent(project.path)
        logger.info("Opening \(project.type.displayName, privacy: .public) project at \(targetURL.path, privacy: .public)")

        if let bundleID = project.type.bundleIdentifier,
           let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) {
            let config = NSWorkspace.OpenConfiguration()
            NSWorkspace.shared.open([targetURL], withApplicationAt: appURL, configuration: config) { _, error in
                if let error = error {
                    logger.error("Failed to open \(project.type.displayName, privacy: .public): \(error.localizedDescription, privacy: .public)")
                }
            }
        } else {
            NSWorkspace.shared.open(targetURL)
        }
    }

    /// Runs IDE detection asynchronously on a background queue.
    public func detect() {
        guard !isDetecting else { return }
        isDetecting = true

        let rootURL = self.rootURL
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let results = IDEDetector.scan(rootURL: rootURL)
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.detectedIDEs = results
                self.isDetecting = false
                self.logger.info("IDE detection complete: \(results.count) IDE(s) found in \(rootURL.lastPathComponent, privacy: .public)")
                for ide in results {
                    self.logger.debug("  Detected \(ide.type.displayName, privacy: .public): \(ide.path, privacy: .public)")
                }
            }
        }
    }

    /// Synchronous scan for IDE markers. Called from background queue.
    private nonisolated static func scan(rootURL: URL) -> [IDEProject] {
        let fileManager = FileManager.default
        var results: [IDEProject] = []

        // Check top-level entries
        guard let topLevelContents = try? fileManager.contentsOfDirectory(
            at: rootURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        // Also check hidden directories at top level (.vscode, .idea)
        let hiddenContents = (try? fileManager.contentsOfDirectory(
            at: rootURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: []
        ))?.filter { $0.lastPathComponent.hasPrefix(".") } ?? []

        let allTopLevel = topLevelContents + hiddenContents.filter { url in
            !topLevelContents.contains(where: { $0.path == url.path })
        }

        for url in allTopLevel {
            results.append(contentsOf: matchMarkers(url: url, rootURL: rootURL))
        }

        // Check one level deep (subdirectories only)
        let topLevelDirs = allTopLevel.filter { url in
            let isDir = (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
            return isDir && !isMarkerDirectory(url)
        }

        for dirURL in topLevelDirs {
            guard let subContents = try? fileManager.contentsOfDirectory(
                at: dirURL,
                includingPropertiesForKeys: [.isDirectoryKey],
                options: []
            ) else { continue }

            for url in subContents {
                results.append(contentsOf: matchMarkers(url: url, rootURL: rootURL))
            }
        }

        // Deduplicate by id and sort by display name
        var seen = Set<String>()
        let unique = results.filter { seen.insert($0.id).inserted }
        return unique.sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }

    /// Checks if a URL matches any known IDE marker pattern.
    private nonisolated static func matchMarkers(url: URL, rootURL: URL) -> [IDEProject] {
        let filename = url.lastPathComponent
        let ext = url.pathExtension.lowercased()
        let relativePath = relativePathString(from: rootURL, to: url)

        var matches: [IDEProject] = []

        // .xcodeproj directory
        if ext == "xcodeproj" {
            let name = url.deletingPathExtension().lastPathComponent
            matches.append(IDEProject(type: .xcode, path: relativePath, displayName: name))
        }

        // .xcworkspace directory (but not inside .xcodeproj)
        if ext == "xcworkspace" && !url.deletingLastPathComponent().pathExtension.lowercased().contains("xcodeproj") {
            let name = url.deletingPathExtension().lastPathComponent
            matches.append(IDEProject(type: .xcodeWorkspace, path: relativePath, displayName: name))
        }

        // Package.swift file
        if filename == "Package.swift" {
            let isDir = (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
            if !isDir {
                let parentName = url.deletingLastPathComponent().lastPathComponent
                matches.append(IDEProject(type: .swiftPackage, path: relativePath, displayName: parentName))
            }
        }

        // .vscode directory
        if filename == ".vscode" {
            let isDir = (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
            if isDir {
                matches.append(IDEProject(type: .vscode, path: relativePath, displayName: "VS Code"))
            }
        }

        // .idea directory (IntelliJ / Android Studio)
        if filename == ".idea" {
            let isDir = (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
            if isDir {
                // Check if it's Android Studio by looking for an .iml with android
                let ideType = detectJetBrainsType(ideaURL: url)
                matches.append(IDEProject(type: ideType, path: relativePath, displayName: ideType.displayName))
            }
        }

        return matches
    }

    /// Determines whether a directory is itself an IDE marker (not to be recursed into).
    private nonisolated static func isMarkerDirectory(_ url: URL) -> Bool {
        let ext = url.pathExtension.lowercased()
        let name = url.lastPathComponent
        return ext == "xcodeproj" || ext == "xcworkspace" || name == ".vscode" || name == ".idea" || name == ".git"
    }

    /// Determines whether a .idea directory belongs to IntelliJ or Android Studio.
    private nonisolated static func detectJetBrainsType(ideaURL: URL) -> IDEType {
        let fileManager = FileManager.default
        guard let contents = try? fileManager.contentsOfDirectory(
            at: ideaURL,
            includingPropertiesForKeys: nil,
            options: []
        ) else {
            return .intellij
        }

        for fileURL in contents {
            let name = fileURL.lastPathComponent.lowercased()
            if name.contains("android") {
                return .androidStudio
            }
        }
        return .intellij
    }

    /// Computes the relative path string from a root URL to a child URL.
    private nonisolated static func relativePathString(from root: URL, to child: URL) -> String {
        let rootPath = root.path
        let childPath = child.path
        if childPath.hasPrefix(rootPath + "/") {
            return String(childPath.dropFirst(rootPath.count + 1))
        }
        return childPath
    }
}

extension IDEDetector: Loggable {
    public static nonisolated let logger = makeLogger()
}
