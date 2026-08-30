import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

@MainActor
public final class ComposableTabsViewController: ThemedSplitViewController {

    public enum Direction {
        case left, right, above, below

        public var axis: ComposableTabsAxis {
            switch self {
            case .left, .right: return .horizontal
            case .above, .below: return .vertical
            }
        }

        /// Where the *new* pane goes relative to the one being split.
        public var placesNewPaneFirst: Bool {
            self == .left || self == .above
        }

        /// The two directions that offer `axis`, near side first.
        public static func directions(along axis: ComposableTabsAxis) -> [Direction] {
            axis == .horizontal ? [.right, .left] : [.below, .above]
        }
    }

    public let nodeID: UUID
    public let axis: ComposableTabsAxis
    /// The live child list, and the single source of truth for the tree —
    /// `splitViewItems` only exists once the view has loaded, and a restored
    /// but never-displayed tab never loads its view.
    private var layoutChildren: [any ComposableTabsChild]
    private weak var splitDocument: ComposableTabsDocument?
    private let isRoot: Bool

    /// One-shot: after the first real layout the user owns the dividers, and
    /// re-imposing a fraction on every layout pass would fight them.
    private var hasAppliedPreferredThicknesses = false

    /// Callback the host (e.g. window controller) installs on the *root*
    /// `ComposableTabsViewController` of each tab. Fires whenever a layout
    /// change happens that should be persisted, with a fresh snapshot of
    /// the tree. The host is responsible for routing this snapshot into
    /// the document's tab list.
    public var onLayoutDidChange: ((LayoutNode) -> Void)?

    public init(
        nodeID: UUID,
        axis: ComposableTabsAxis,
        children: [any ComposableTabsChild],
        document: ComposableTabsDocument?,
        isRoot: Bool
    ) {
        self.nodeID = nodeID
        self.axis = axis
        self.layoutChildren = children
        self.splitDocument = document
        self.isRoot = isRoot
        super.init(nibName: nil, bundle: nil)
    }

    public convenience init(
        nodeID: UUID,
        axis: ComposableTabsAxis,
        first: any ComposableTabsChild,
        second: any ComposableTabsChild,
        document: ComposableTabsDocument?,
        isRoot: Bool
    ) {
        self.init(
            nodeID: nodeID,
            axis: axis,
            children: [first, second],
            document: document,
            isRoot: isRoot
        )
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    /// The layout governing this tree — the document's, or the placeholder-only
    /// fallback if the document has gone away.
    var layout: ComposableTabsLayout {
        splitDocument?.layout ?? ComposableTabsLayout.placeholderOnly()
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        splitView.isVertical = (axis == .horizontal)
        splitView.dividerStyle = .thin

        for child in layoutChildren {
            addSplitViewItem(makeItem(for: child.viewController))
        }
    }

    /// `preferredThicknessFraction` alone is not enough. AppKit resolves it
    /// against whatever thickness the split view has when the item is installed,
    /// and in `viewDidLoad` that is still the placeholder frame from `loadView`
    /// — where a 22% sidebar clamps to its minimum and then grows with the
    /// window, ending up at more than half of it. By the first real layout pass
    /// the thickness is the window's, so the fraction means what it says.
    public override func viewDidLayout() {
        super.viewDidLayout()
        applyPreferredThicknessesIfNeeded()
    }

    private func applyPreferredThicknessesIfNeeded() {
        guard !hasAppliedPreferredThicknesses else { return }
        let total = splitView.isVertical ? splitView.bounds.width : splitView.bounds.height
        // A zero-thickness pass carries no information; wait for a real one.
        guard total > 1 else { return }
        hasAppliedPreferredThicknesses = true

        var offset: CGFloat = 0
        for index in 0..<max(splitViewItems.count - 1, 0) {
            let item = splitViewItems[index]
            var thickness = self.thickness(of: item.viewController.view)
            if item.preferredThicknessFraction > 0 {
                thickness = max(item.minimumThickness, total * item.preferredThicknessFraction)
                splitView.setPosition(offset + thickness, ofDividerAt: index)
            }
            offset += thickness
        }
    }

    private func thickness(of view: NSView) -> CGFloat {
        splitView.isVertical ? view.frame.width : view.frame.height
    }

    // MARK: - Mutation

    /// Splits `child`, putting a pane showing `viewID` beside it.
    ///
    /// The view to add is a parameter rather than a copy of what the pane
    /// already shows: which views may go here is the spec's answer, and a pane
    /// that duplicated its own content would walk straight through a `max: 1`.
    public func split(
        _ child: ComposableTabsPaneViewController,
        adding viewID: ComposableTabsViewID,
        direction: Direction
    ) {
        guard let index = layoutChildren.firstIndex(where: { $0.viewController === child }),
              let document = splitDocument else { return }

        let sibling = ComposableTabsPaneViewController(
            nodeID: UUID(),
            paneNumber: document.allocatePaneNumber(),
            viewID: viewID,
            document: document
        )

        let firstChildVC: ComposableTabsPaneViewController
        let secondChildVC: ComposableTabsPaneViewController
        if direction.placesNewPaneFirst {
            firstChildVC = sibling
            secondChildVC = child
        } else {
            firstChildVC = child
            secondChildVC = sibling
        }

        // The child moves *into* the new inner split, so detach it from this
        // one first — `removeSplitViewItem` is what un-parents the controller.
        if isViewLoaded, let item = splitViewItems.first(where: { $0.viewController === child }) {
            removeSplitViewItem(item)
        }

        let inner = ComposableTabsViewController(
            nodeID: UUID(),
            axis: direction.axis,
            first: firstChildVC,
            second: secondChildVC,
            document: document,
            isRoot: false
        )
        layoutChildren[index] = inner
        if isViewLoaded {
            insertSplitViewItem(makeItem(for: inner), at: index)
        }

        // Propagate to root, which persists the full tree.
        rootSplit()?.persistTreeToDocument()
    }

    /// Removes a leaf pane. The surviving sibling expands into the vacated
    /// space; the enclosing tab is never resized. A non-root split left with
    /// one child is a degenerate split, so it collapses into its parent, which
    /// adopts the survivor at the same position. The *root* may legitimately
    /// hold a single child — that is a tab reduced to one full-size pane.
    public func remove(_ child: ComposableTabsPaneViewController) {
        guard let index = layoutChildren.firstIndex(where: { $0.viewController === child }) else { return }

        // `rootSplit()` walks up through `parent`, so it has to be resolved
        // before a collapse detaches this controller from the tree.
        let root = rootSplit()
        // Every removal rule — the tab's last pane, a fixed region, a view the
        // spec requires — lives in the spec, so the tree asks it rather than
        // trusting whichever UI happened to call in.
        guard (root ?? self).canRemoveLeaf(child) else { return }
        let hadFocus = child.containsFirstResponder

        layoutChildren.remove(at: index)
        if isViewLoaded, let item = splitViewItems.first(where: { $0.viewController === child }) {
            removeSplitViewItem(item)
        }
        // The pane is gone from the tree for good, so its content releases what
        // it holds now — otherwise a closed pane's shells and file watchers run
        // on until the last reference happens to drop.
        child.paneWillBeRemoved()

        if layoutChildren.count == 1, !isRoot, let parentSplit = parent as? ComposableTabsViewController {
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

    private func replaceChild(
        _ old: ComposableTabsViewController,
        with replacement: any ComposableTabsChild
    ) {
        guard let index = layoutChildren.firstIndex(where: { $0.viewController === old }) else { return }
        layoutChildren[index] = replacement
        guard isViewLoaded,
              let item = splitViewItems.first(where: { $0.viewController === old }) else { return }
        removeSplitViewItem(item)
        insertSplitViewItem(makeItem(for: replacement.viewController), at: index)
    }

    // MARK: - Spec-driven legal moves

    /// Views that may be added beside `leaf`, with the direction to offer each
    /// one first. Asked of the root, because a `max` declared at the top of the
    /// spec counts across the whole tab.
    public func allowedInsertions(
        beside leaf: ComposableTabsPaneViewController
    ) -> [ComposableTabLayoutSpec.Insertion] {
        guard let root = rootSplit() else { return [] }
        return layout.spec.allowedInsertions(
            at: leaf.nodeID,
            in: root.snapshotNode(),
            registry: layout.registry
        )
    }

    public func canRemoveLeaf(_ leaf: ComposableTabsPaneViewController) -> Bool {
        guard let root = rootSplit() else { return false }
        return layout.spec.canRemove(leaf.nodeID, from: root.snapshotNode())
    }

    // MARK: - Tree walking

    func rootSplit() -> ComposableTabsViewController? {
        var current: ComposableTabsViewController? = self
        while let parent = current?.parent as? ComposableTabsViewController {
            current = parent
        }
        return current
    }

    /// Number of leaf panes in this subtree.
    public func leafCount() -> Int {
        layoutChildren.reduce(0) { total, child in
            if let split = child as? ComposableTabsViewController {
                return total + split.leafCount()
            }
            return total + 1
        }
    }

    /// First leaf in depth-first order, used to re-home first responder after
    /// the focused pane is removed.
    public func firstLeaf() -> ComposableTabsPaneViewController? {
        for child in layoutChildren {
            if let leaf = child as? ComposableTabsPaneViewController { return leaf }
            if let split = child as? ComposableTabsViewController, let leaf = split.firstLeaf() {
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
            return LayoutNode.leaf(contentType: .placeholder)
        case 1:
            return snapshots[0]
        default:
            return LayoutNode.split(
                id: nodeID,
                orientation: axis,
                first: snapshots[0],
                second: snapshots[1]
            )
        }
    }

    private func snapshotChild(_ child: any ComposableTabsChild) -> LayoutNode {
        if let split = child as? ComposableTabsViewController {
            return split.snapshotNode()
        }
        if let leaf = child as? ComposableTabsPaneViewController {
            return LayoutNode.leaf(id: leaf.nodeID, contentType: leaf.viewID)
        }
        // Fallback — should not occur under the current class hierarchy.
        return LayoutNode.leaf(id: UUID(), contentType: .placeholder)
    }

    /// Sizing comes from whatever the leaf's view registered — or, for a
    /// nested split, from everything underneath it.
    private func makeItem(for viewController: NSViewController) -> NSSplitViewItem {
        let item = NSSplitViewItem(viewController: viewController)
        let registry = layout.registry
        let descriptor = (viewController as? ComposableTabsPaneViewController)
            .map { registry.descriptor(for: $0.viewID) }
        item.minimumThickness = Self.minimumThickness(
            of: viewController, along: axis, registry: registry)
        item.canCollapse = descriptor?.isCollapsible ?? false
        if let fraction = descriptor?.preferredThicknessFraction {
            item.preferredThicknessFraction = fraction
        }
        // A pane that asked for a share of the window keeps the width it gets;
        // a higher holding priority makes AppKit take a window resize out of
        // its neighbours instead of spreading it around. A sidebar that grew
        // with the window would be a third of a wide display.
        item.holdingPriority = descriptor?.resolvedHoldingPriority ?? .defaultLow
        return item
    }

    /// What a subtree needs along `axis`. A leaf answers from its registration;
    /// a nested split answers from its children — summed when they are arranged
    /// along that axis, maxed when they are stacked across it.
    ///
    /// Without this a split is just "some view controller" and takes the bare
    /// default, so an outer split believes a half holding a 320pt notes pane
    /// beside a 400pt terminal can be squeezed to 120.
    private static func minimumThickness(
        of viewController: NSViewController,
        along axis: ComposableTabsAxis,
        registry: ComposableTabsViewRegistry
    ) -> CGFloat {
        if let leaf = viewController as? ComposableTabsPaneViewController {
            return registry.descriptor(for: leaf.viewID).minimumThickness
        }
        guard let split = viewController as? ComposableTabsViewController,
              !split.layoutChildren.isEmpty else {
            return ComposableTabsViewDescriptor.placeholder.minimumThickness
        }
        let thicknesses = split.layoutChildren.map {
            minimumThickness(of: $0.viewController, along: axis, registry: registry)
        }
        return split.axis == axis
            ? thicknesses.reduce(0, +)
            : (thicknesses.max() ?? ComposableTabsViewDescriptor.placeholder.minimumThickness)
    }

    // MARK: - Construction from persisted layout

    /// Builds a root or nested `ComposableTabsViewController` +
    /// `ComposableTabsPaneViewController` tree from a value-type `LayoutNode`.
    /// A leaf at the top level is a tab that was reduced to a single pane; it is
    /// hosted in a root split holding that one child, which fills the tab.
    public static func make(
        from node: LayoutNode,
        document: ComposableTabsDocument,
        isRoot: Bool
    ) -> ComposableTabsViewController {
        switch node.kind {
        case .split:
            return buildSplit(node, document: document, isRoot: isRoot)
        case .leaf:
            return ComposableTabsViewController(
                nodeID: UUID(),
                axis: .horizontal,
                children: [buildChild(node, document: document)],
                document: document,
                isRoot: isRoot
            )
        }
    }

    private static func buildSplit(
        _ node: LayoutNode,
        document: ComposableTabsDocument,
        isRoot: Bool
    ) -> ComposableTabsViewController {
        guard case .split(let axis, let first, let second) = node.kind else {
            // Unreachable given `make(from:)` routes leaves elsewhere — fail loudly if violated.
            fatalError("buildSplit called with non-split node")
        }
        return ComposableTabsViewController(
            nodeID: node.id,
            axis: axis,
            first: buildChild(first, document: document),
            second: buildChild(second, document: document),
            document: document,
            isRoot: isRoot
        )
    }

    private static func buildChild(
        _ node: LayoutNode,
        document: ComposableTabsDocument
    ) -> any ComposableTabsChild {
        switch node.kind {
        case .split:
            return buildSplit(node, document: document, isRoot: false)
        case .leaf(let viewID, _):
            return ComposableTabsPaneViewController(
                nodeID: node.id,
                paneNumber: document.allocatePaneNumber(),
                viewID: viewID,
                document: document
            )
        }
    }
}

/// Type-erasing protocol so `ComposableTabsViewController` can hold either a
/// leaf or a nested split.
@MainActor
public protocol ComposableTabsChild: AnyObject {
    var viewController: NSViewController { get }
}

extension ComposableTabsPaneViewController: ComposableTabsChild {
    public var viewController: NSViewController { self }
}

extension ComposableTabsViewController: ComposableTabsChild {
    public var viewController: NSViewController { self }
}
