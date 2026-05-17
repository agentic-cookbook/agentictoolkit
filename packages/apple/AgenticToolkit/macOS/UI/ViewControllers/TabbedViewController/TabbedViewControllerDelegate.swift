import AppKit
import Foundation

/// Hosts of `TabbedViewController` implement this protocol to react to user
/// actions on any edge's tab bar — adding new tabs, switching tabs, closing
/// tabs, reordering tabs. Every callback names the `Edge` whose bar fired
/// the event so a host with multiple enabled edges can route accordingly.
@MainActor
public protocol TabbedViewControllerDelegate: AnyObject {

    /// User triggered "New Tab" (e.g. via the File menu). The host should
    /// build a content view controller and call `addTab(_:on:)` on the
    /// `TabbedViewController` for the given edge.
    func tabbedViewControllerNeedsNewTab(_ controller: TabbedViewController, on edge: Edge)

    /// The active tab on `edge` changed. Always called when the selection
    /// moves — programmatic or user-driven.
    func tabbedViewController(_ controller: TabbedViewController, didSelectTab id: UUID, on edge: Edge)

    /// User clicked the close button on a tab on `edge`. The host can veto
    /// by simply not calling `removeTab(id:)` in response. By default the
    /// host should honor the request unless this is the last tab on that
    /// edge.
    func tabbedViewController(_ controller: TabbedViewController, didRequestCloseTab id: UUID, on edge: Edge)

    /// User dragged a tab on `edge` to a new position within that edge.
    /// Already applied to the edge's tab list.
    func tabbedViewController(_ controller: TabbedViewController, didReorderTab id: UUID, to index: Int, on edge: Edge)
}

extension TabbedViewControllerDelegate {
    public func tabbedViewControllerNeedsNewTab(_ controller: TabbedViewController, on edge: Edge) {}
    public func tabbedViewController(_ controller: TabbedViewController, didSelectTab id: UUID, on edge: Edge) {}
    public func tabbedViewController(_ controller: TabbedViewController, didRequestCloseTab id: UUID, on edge: Edge) {
        controller.removeTab(id: id)
    }
    public func tabbedViewController(
        _ controller: TabbedViewController,
        didReorderTab id: UUID,
        to index: Int,
        on edge: Edge
    ) {}
}
