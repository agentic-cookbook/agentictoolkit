import Combine
import Foundation

/// What a file browser looked like: the folders that were disclosed, and the
/// file that was selected.
///
/// Paths rather than nodes, because nothing in a tree survives a relaunch —
/// every `FileTreeNode` is built by a scan that has not run yet when this is
/// handed in. A path is the one identity a folder keeps across launches, and it
/// is also the identity the tree can match against as rows arrive.
///
/// Injected and reported through `onChange`, exactly like
/// `FileBrowserDirectories`: the tree has no idea whether it is backed by a
/// project database, defaults, or nothing at all (`dependency-injection`).
@MainActor
public final class FileBrowserRestorationState: ObservableObject {

    /// The `path` of every directory that should be open, including the root
    /// headers. A set, because "is this one open" is the only question ever
    /// asked of it.
    public private(set) var expandedPaths: Set<String>

    /// The `path` of the selected file, or `nil`.
    public private(set) var selectedPath: String?

    /// Called whenever either changes, so a host can persist them.
    public var onChange: ((_ expandedPaths: [String], _ selectedPath: String?) -> Void)?

    public init(expandedPaths: [String] = [], selectedPath: String? = nil) {
        self.expandedPaths = Set(expandedPaths)
        self.selectedPath = selectedPath
    }

    public func isExpanded(_ path: String) -> Bool {
        expandedPaths.contains(path)
    }

    public func setExpanded(_ isExpanded: Bool, path: String) {
        let changed = isExpanded ? expandedPaths.insert(path).inserted : (expandedPaths.remove(path) != nil)
        guard changed else { return }
        report()
    }

    public func setSelectedPath(_ path: String?) {
        guard path != selectedPath else { return }
        selectedPath = path
        report()
    }

    /// Sorted, so two identical arrangements serialize identically and a host
    /// that compares before writing is not fooled by set ordering
    /// (`idempotency`).
    private func report() {
        onChange?(expandedPaths.sorted(), selectedPath)
    }
}
