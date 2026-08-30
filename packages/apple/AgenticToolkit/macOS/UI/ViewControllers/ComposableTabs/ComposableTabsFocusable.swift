import AppKit
import Foundation

/// Lets a host (e.g. a window controller) ask a `ComposableTabsViewController`
/// which leaf is currently focused and request that a particular leaf
/// become first responder. Stays out of `MultiTabbedViewController` so the tab
/// container doesn't need to know about the split-view internals.
@MainActor
public protocol ComposableTabsFocusable: AnyObject {
    /// The `nodeID` of the deepest `ComposableTabsPaneViewController` whose view tree
    /// currently contains the window's first responder, or `nil` if no
    /// leaf in this controller's tree is focused.
    var focusedLeafNodeID: UUID? { get }

    /// Walks the controller tree, finds the leaf whose `nodeID` matches,
    /// and asks the window to make that leaf's view the first responder.
    /// No-op if no leaf with that id exists in this tree.
    func makeLeafFirstResponder(nodeID: UUID)
}

extension ComposableTabsViewController: ComposableTabsFocusable {

    public var focusedLeafNodeID: UUID? {
        guard let firstResponder = view.window?.firstResponder as? NSView else {
            return view.window?.firstResponder == nil ? nil : nil
        }
        return findFocusedLeaf(under: self, firstResponder: firstResponder)
    }

    public func makeLeafFirstResponder(nodeID: UUID) {
        guard let leaf = findLeaf(under: self, nodeID: nodeID) else { return }
        view.window?.makeFirstResponder(leaf.view)
    }

    /// Recursive walk: tries each child split's tree, then checks if a
    /// direct leaf child contains `firstResponder`.
    private func findFocusedLeaf(under split: ComposableTabsViewController, firstResponder: NSView) -> UUID? {
        for item in split.splitViewItems {
            if let childSplit = item.viewController as? ComposableTabsViewController,
               let nested = findFocusedLeaf(under: childSplit, firstResponder: firstResponder) {
                return nested
            }
            if let leaf = item.viewController as? ComposableTabsPaneViewController,
               isView(firstResponder, descendantOf: leaf.view) {
                return leaf.nodeID
            }
        }
        return nil
    }

    private func findLeaf(
        under split: ComposableTabsViewController,
        nodeID: UUID
    ) -> ComposableTabsPaneViewController? {
        for item in split.splitViewItems {
            if let leaf = item.viewController as? ComposableTabsPaneViewController, leaf.nodeID == nodeID {
                return leaf
            }
            if let childSplit = item.viewController as? ComposableTabsViewController,
               let leaf = findLeaf(under: childSplit, nodeID: nodeID) {
                return leaf
            }
        }
        return nil
    }

    private func isView(_ candidate: NSView, descendantOf ancestor: NSView) -> Bool {
        var current: NSView? = candidate
        while let view = current {
            if view === ancestor { return true }
            current = view.superview
        }
        return false
    }
}
