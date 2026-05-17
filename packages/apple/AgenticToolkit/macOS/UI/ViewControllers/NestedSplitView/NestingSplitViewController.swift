import AppKit

@MainActor
public final class NestingSplitViewController: NSSplitViewController {

    public enum Direction {
        case left, right, above, below
    }

    public let nodeID: UUID
    private let orientation: NSUserInterfaceLayoutOrientation
    private let firstChild: any NestedChild
    private let secondChild: any NestedChild
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
        first: any NestedChild,
        second: any NestedChild,
        document: NestedSplitViewDocument?,
        isRoot: Bool
    ) {
        self.nodeID = nodeID
        self.orientation = orientation
        self.firstChild = first
        self.secondChild = second
        self.splitDocument = document
        self.isRoot = isRoot
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        splitView.isVertical = (orientation == .horizontal)
        splitView.dividerStyle = .thin

        addSplitViewItem(Self.makeItem(for: firstChild.viewController))
        addSplitViewItem(Self.makeItem(for: secondChild.viewController))
    }

    public func split(_ child: NestedViewController, direction: Direction) {
        guard let item = splitViewItems.first(where: { $0.viewController === child }),
              let index = splitViewItems.firstIndex(of: item),
              let document = splitDocument else { return }

        removeSplitViewItem(item)

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

        let inner = NestingSplitViewController(
            nodeID: UUID(),
            orientation: newOrientation,
            first: firstChildVC,
            second: secondChildVC,
            document: document,
            isRoot: false
        )
        let innerItem = NSSplitViewItem(viewController: inner)
        innerItem.minimumThickness = 120
        innerItem.holdingPriority = .defaultLow
        insertSplitViewItem(innerItem, at: index)

        // Propagate to root, which persists the full tree.
        rootSplit()?.persistTreeToDocument()
    }

    // MARK: - Tree walking

    private func rootSplit() -> NestingSplitViewController? {
        var current: NestingSplitViewController? = self
        while let parent = current?.parent as? NestingSplitViewController {
            current = parent
        }
        return current
    }

    fileprivate func persistTreeToDocument() {
        guard isRoot else { return }
        onLayoutDidChange?(snapshotNode())
    }

    /// Value-type snapshot of the live controller tree.
    public func snapshotNode() -> LayoutNode {
        let firstSnap = snapshotChild(splitViewItems[0].viewController)
        let secondSnap = snapshotChild(splitViewItems[1].viewController)
        let orientationString = (orientation == .horizontal) ? "horizontal" : "vertical"
        return LayoutNode.split(id: nodeID, orientation: orientationString, first: firstSnap, second: secondSnap)
    }

    private func snapshotChild(_ viewController: NSViewController) -> LayoutNode {
        if let split = viewController as? NestingSplitViewController {
            return split.snapshotNode()
        }
        if let leaf = viewController as? NestedViewController {
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
    /// from a value-type `LayoutNode`. For leaves at the top level this still wraps in a
    /// horizontal split with a fresh sibling so the window always presents a split view.
    public static func make(
        from node: LayoutNode,
        document: NestedSplitViewDocument,
        isRoot: Bool
    ) -> NestingSplitViewController {
        let rootNode: LayoutNode
        switch node.kind {
        case .split:
            rootNode = node
        case .leaf:
            // A document that somehow stored a single leaf at the root — wrap it.
            rootNode = LayoutNode.split(
                orientation: "horizontal",
                first: node,
                second: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier)
            )
        }
        return buildSplit(rootNode, document: document, isRoot: isRoot)
    }

    private static func buildSplit(
        _ node: LayoutNode,
        document: NestedSplitViewDocument,
        isRoot: Bool
    ) -> NestingSplitViewController {
        guard case .split(let orientationString, let first, let second) = node.kind else {
            // Unreachable given `make(from:)` wraps leaves — fail loudly if violated.
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
