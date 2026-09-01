import Combine
import Foundation

/// The file the browser currently has selected.
///
/// The tree and whatever displays the selected file are separate view
/// controllers, so the selection belongs to neither: parking it in one would
/// make the other reach sideways into its sibling. A small observable injected
/// into both keeps every dependency pointing one way
/// (`dependency-injection`), and leaves `FileBrowserViewController` perfectly
/// usable on its own — with a selection nobody happens to be watching.
@MainActor
public final class FileBrowserSelection: ObservableObject {

    /// The selected node, or `nil` when nothing is selected. Directories and
    /// packages select like anything else; deciding they have no contents to
    /// show is the viewer's job, not the tree's.
    @Published public var selectedNode: FileTreeNode?

    /// The root the `+`/`−` footer acts on. Set by clicking a root's header, or
    /// derived from the selected file when the user clicked into a tree.
    ///
    /// Here rather than on `FileBrowserDirectories` because it is a fact about
    /// *this browser*, not about the project: the root list is shared by every
    /// browser pane of a project, and two panes highlighting each other's
    /// clicks would be the surprise (`srp` — the list and the pointer into it
    /// answer to different actors).
    @Published public var selectedRoot: URL?

    public init(selectedNode: FileTreeNode? = nil, selectedRoot: URL? = nil) {
        self.selectedNode = selectedNode
        self.selectedRoot = selectedRoot
    }
}
