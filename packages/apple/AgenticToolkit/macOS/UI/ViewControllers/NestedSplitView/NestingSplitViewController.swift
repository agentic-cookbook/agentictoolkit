import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

@MainActor
public final class NestingSplitViewController: ThemedSplitViewController {

    public enum Direction {
        case left, right, above, below
    }

    public let nodeID: UUID
    private let orientation: NSUserInterfaceLayoutOrientation
    /// The live child list, and the single source of truth for the tree —
    /// `splitViewItems` only exists once the view has loaded, and a restored
    /// but never-displayed tab never loads its view.
    private var layoutChildren: [any NestedChild]
    private weak var splitDocument: NestedSplitViewDocument?
    private let isRoot: Bool

    /// Callback the host (e.g. window controller) installs on the *root*
    /// `NestingSplitViewController` of each tab. Fires whenever a layout
    /// change happens that should be persisted, with a fresh snapshot of
    /// the tree. The host is responsible for routing this snapshot into
    /// the document's tab list.
    public var onLayoutDidChange: ((LayoutNode) -> Void)?

    public init(
        nodeID: UUID,
        orientation: NSUserInterfaceLayoutOrientation,
        children: [any NestedChild],
        document: NestedSplitViewDocument?,
        isRoot: Bool
    ) {
        self.nodeID = nodeID
        self.orientation = orientation
        self.layoutChildren = children
        self.splitDocument = document
        self.isRoot = isRoot
        super.init(nibName: nil, bundle: nil)
    }

    public convenience init(
        nodeID: UUID,
        orientation: NSUserInterfaceLayoutOrientation,
        first: any NestedChild,
        second: any NestedChild,
        document: NestedSplitViewDocument?,
        isRoot: Bool
    ) {
        self.init(
            nodeID: nodeID,
            orientation: orientation,
            children: [first, second],
            document: document,
            isRoot: isRoot
        )
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        splitView.isVertical = (orientation == .horizontal)
        splitView.dividerStyle = .thin

        for child in layoutChildren {
            addSplitViewItem(Self.makeItem(for: child.viewController))
        }
    }

    // MARK: - Mutation

    public func split(_ child: NestedViewController, direction: Direction) {
        guard let index = layoutChildren.firstIndex(where: { $0.viewController === child }),
              let document = splitDocument else { return }

        let sibling = NestedViewController(
            nodeID: UUID(),
            paneNumber: document.allocatePaneNumber(),
            contentTypeIdentifier: child.contentTypeIdentifier,
            document: document
        )

        let newOrientation: NSUserInterfaceLayoutOrientation
        let firstChildVC: NestedViewController
        let secondChildVC: NestedViewController
        switch direction {
        case .right:
            newOrientation = .horizontal
            firstChildVC = child
            secondChildVC = sibling
        case .left:
            newOrientation = .horizontal
            firstChildVC = sibling
            secondChildVC = child
        case .below:
            newOrientation = .vertical
            firstChildVC = child
            secondChildVC = sibling
        case .above:
            newOrientation = .vertical
            firstChildVC = sibling
            secondChildVC = child
        }

        // The child moves *into* the new inner split, so detach it from this
        // one first — `removeSplitViewItem` is what un-parents the controller.
        if isViewLoaded, let item = splitViewItems.first(where: { $0.viewController === child }) {
            removeSplitViewItem(item)
        }

        let inner = NestingSplitViewController(
            nodeID: UUID(),
            orientation: newOrientation,
            first: firstChildVC,
            second: secondChildVC,
            document: document,
            isRoot: false
        )
        layoutChildren[index] = inner
        if isViewLoaded {
            insertSplitViewItem(Self.makeItem(for: inner), at: index)
        }

        // Propagate to root, which persists the full tree.
        rootSplit()?.persistTreeToDocument()
    }

    /// Removes a leaf pane. The surviving sibling expands into the vacated
    /// space; the enclosing tab is never resized. A non-root split left with
    /// one child is a degenerate split, so it collapses into its parent, which
    /// adopts the survivor at the same position. The *root* may legitimately
    /// hold a single child — that is a tab reduced to one full-size pane.
    public func remove(_ child: NestedViewController) {
        guard let index = layoutChildren.firstIndex(where: { $0.viewController === child }) else { return }

        // `rootSplit()` walks up through `parent`, so it has to be resolved
        // before a collapse detaches this controller from the tree.
        let root = rootSplit()
        // A tab always keeps at least one pane — there is nothing else to fill
        // the space. The menu greys "Remove" out at that point, but the rule
        // belongs to the tree, not to whichever UI happens to call in.
        guard (root ?? self).leafCount() > 1 else { return }
        let hadFocus = child.containsFirstResponder

        layoutChildren.remove(at: index)
        if isViewLoaded, let item = splitViewItems.first(where: { $0.viewController === child }) {
            removeSplitViewItem(item)
        }

        if layoutChildren.count == 1, !isRoot, let parentSplit = parent as? NestingSplitViewController {
            let survivor = layoutChildren[0]
            if isViewLoaded,
               let item = splitViewItems.first(where: { $0.viewController === survivor.viewController }) {
                removeSplitViewItem(item)
            }
            layoutChildren.removeAll()
            parentSplit.replaceChild(self, with: survivor)
        }

        if hadFocus, let root, let leaf = root.firstLeaf() {
            root.view.window?.makeFirstResponder(leaf.view)
        }
        root?.persistTreeToDocument()
    }

    private func replaceChild(_ old: NestingSplitViewController, with replacement: any NestedChild) {
        guard let index = layoutChildren.firstIndex(where: { $0.viewController === old }) else { return }
        layoutChildren[index] = replacement
        guard isViewLoaded,
              let item = splitViewItems.first(where: { $0.viewController === old }) else { return }
        removeSplitViewItem(item)
        insertSplitViewItem(Self.makeItem(for: replacement.viewController), at: index)
    }

    // MARK: - Tree walking

    func rootSplit() -> NestingSplitViewController? {
        var current: NestingSplitViewController? = self
        while let parent = current?.parent as? NestingSplitViewController {
            current = parent
        }
        return current
    }

    /// Number of leaf panes in this subtree. Drives the "Remove" menu item's
    /// enablement — the last pane in a tab cannot be removed.
    public func leafCount() -> Int {
        layoutChildren.reduce(0) { total, child in
            if let split = child as? NestingSplitViewController {
                return total + split.leafCount()
            }
            return total + 1
        }
    }

    /// First leaf in depth-first order, used to re-home first responder after
    /// the focused pane is removed.
    public func firstLeaf() -> NestedViewController? {
        for child in layoutChildren {
            if let leaf = child as? NestedViewController { return leaf }
            if let split = child as? NestingSplitViewController, let leaf = split.firstLeaf() {
                return leaf
            }
        }
        return nil
    }

    fileprivate func persistTreeToDocument() {
        guard isRoot else { return }
        onLayoutDidChange?(snapshotNode())
    }

    /// Value-type snapshot of the live controller tree.
    ///
    /// A root holding a single child snapshots *as* that child: the extra
    /// wrapper is a runtime detail of hosting a lone pane in a split view
    /// controller, not part of the persisted layout.
    public func snapshotNode() -> LayoutNode {
        let snapshots = layoutChildren.map { snapshotChild($0) }
        switch snapshots.count {
        case 0:
            return LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier)
        case 1:
            return snapshots[0]
        default:
            let orientationString = (orientation == .horizontal) ? "horizontal" : "vertical"
            return LayoutNode.split(
                id: nodeID,
                orientation: orientationString,
                first: snapshots[0],
                second: snapshots[1]
            )
        }
    }

    private func snapshotChild(_ child: any NestedChild) -> LayoutNode {
        if let split = child as? NestingSplitViewController {
            return split.snapshotNode()
        }
        if let leaf = child as? NestedViewController {
            return LayoutNode.leaf(id: leaf.nodeID, contentType: leaf.contentTypeIdentifier)
        }
        // Fallback — should not occur under the current class hierarchy.
        return LayoutNode.leaf(id: UUID(), contentType: NestedContentRegistry.placeholderIdentifier)
    }

    private static func makeItem(for viewController: NSViewController) -> NSSplitViewItem {
        let item = NSSplitViewItem(viewController: viewController)
        item.minimumThickness = 120
        item.holdingPriority = .defaultLow
        return item
    }

    // MARK: - Construction from persisted layout

    /// Builds a root or nested `NestingSplitViewController` + `NestedViewController` tree
    /// from a value-type `LayoutNode`. A leaf at the top level is a tab that was reduced
    /// to a single pane; it is hosted in a root split holding that one child, which fills
    /// the tab.
    public static func make(
        from node: LayoutNode,
        document: NestedSplitViewDocument,
        isRoot: Bool
    ) -> NestingSplitViewController {
        switch node.kind {
        case .split:
            return buildSplit(node, document: document, isRoot: isRoot)
        case .leaf:
            return NestingSplitViewController(
                nodeID: UUID(),
                orientation: .horizontal,
                children: [buildChild(node, document: document)],
                document: document,
                isRoot: isRoot
            )
        }
    }

    private static func buildSplit(
        _ node: LayoutNode,
        document: NestedSplitViewDocument,
        isRoot: Bool
    ) -> NestingSplitViewController {
        guard case .split(let orientationString, let first, let second) = node.kind else {
            // Unreachable given `make(from:)` routes leaves elsewhere — fail loudly if violated.
            fatalError("buildSplit called with non-split node")
        }
        let orientation: NSUserInterfaceLayoutOrientation =
            (orientationString == "horizontal") ? .horizontal : .vertical
        let firstChild = buildChild(first, document: document)
        let secondChild = buildChild(second, document: document)
        return NestingSplitViewController(
            nodeID: node.id,
            orientation: orientation,
            first: firstChild,
            second: secondChild,
            document: document,
            isRoot: isRoot
        )
    }

    private static func buildChild(_ node: LayoutNode, document: NestedSplitViewDocument) -> any NestedChild {
        switch node.kind {
        case .split:
            return buildSplit(node, document: document, isRoot: false)
        case .leaf(let contentType, _):
            let paneNumber = document.allocatePaneNumber()
            return NestedViewController(
                nodeID: node.id,
                paneNumber: paneNumber,
                contentTypeIdentifier: contentType,
                document: document
            )
        }
    }
}

/// Type-erasing protocol so `NestingSplitViewController` can hold either a leaf or a nested split.
@MainActor
public protocol NestedChild: AnyObject {
    var viewController: NSViewController { get }
}

extension NestedViewController: NestedChild {
    public var viewController: NSViewController { self }
}

extension NestingSplitViewController: NestedChild {
    public var viewController: NSViewController { self }
}
