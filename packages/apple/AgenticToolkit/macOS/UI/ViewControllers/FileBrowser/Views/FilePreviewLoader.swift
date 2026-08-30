import Foundation

import AgenticToolkitCore

/// What the file viewer should put on screen for a given file.
///
/// Kept apart from the view so the "text or QuickLook" rule lives in one
/// testable place instead of being spelled out inside a `body` (`srp`).
enum FilePreviewContent: Equatable {

    /// UTF-8 text, editable in the source editor.
    case text(String)

    /// Not text, but something QuickLook renders — an image, a PDF, a movie.
    /// Also where a text file too large to hold in memory lands, because
    /// QuickLook streams it instead of loading the whole thing.
    case quickLook

    /// Unreadable: gone, or permission denied.
    case unavailable
}

/// Reads a file and decides how to show it.
enum FilePreviewLoader {

    /// Above this, a file goes to QuickLook rather than the editor. The editor
    /// holds the whole string in memory and re-highlights it; QuickLook does
    /// not, so the cap is about the editor, not about the file.
    static let maximumTextSize = 8 * 1024 * 1024

    /// - Returns: How `url` should be displayed.
    ///
    /// `nonisolated` and `async` on purpose: Swift 6 runs a nonisolated async
    /// function on the cooperative pool rather than the caller's executor, so a
    /// main-actor caller awaits this without the disk read landing on the main
    /// thread.
    static func read(_ url: URL) async -> FilePreviewContent {
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize
        if let size, size > maximumTextSize {
            return .quickLook
        }

        guard let data = try? Data(contentsOf: url, options: .mappedIfSafe) else {
            logger.error("Cannot read \(url.lastPathComponent, privacy: .public)")
            return .unavailable
        }

        guard let text = String(data: data, encoding: .utf8) else {
            return .quickLook
        }

        return .text(text)
    }
}

extension FilePreviewLoader: Loggable {
    public static nonisolated let logger = makeLogger()
}
