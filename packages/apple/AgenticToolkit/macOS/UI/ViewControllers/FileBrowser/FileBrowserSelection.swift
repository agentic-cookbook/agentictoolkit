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

    public init(selectedNode: FileTreeNode? = nil) {
        self.selectedNode = selectedNode
    }
}
