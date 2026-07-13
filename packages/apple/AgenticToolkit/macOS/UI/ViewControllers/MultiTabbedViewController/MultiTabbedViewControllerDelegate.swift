import AppKit
import Foundation

/// Hosts of `MultiTabbedViewController` implement this protocol to react to user
/// actions on any edge's tab bar — adding new tabs, switching tabs, closing
/// tabs, reordering tabs. Every callback names the `Edge` whose bar fired
/// the event so a host with multiple enabled edges can route accordingly.
@MainActor
public protocol MultiTabbedViewControllerDelegate: AnyObject {

    /// User triggered "New Tab" (e.g. via the File menu). The host should
    /// build a content view controller and call `addTab(_:on:)` on the
    /// `MultiTabbedViewController` for the given edge.
    func multiTabbedViewControllerNeedsNewTab(_ controller: MultiTabbedViewController, on edge: Edge)

    /// The active tab on `edge` changed. Always called when the selection
    /// moves — programmatic or user-driven.
    func multiTabbedViewController(_ controller: MultiTabbedViewController, didSelectTab id: UUID, on edge: Edge)

    /// User clicked the close button on a tab on `edge`. The host can veto
    /// by simply not calling `removeTab(id:)` in response. By default the
    /// host should honor the request unless this is the last tab on that
    /// edge.
    func multiTabbedViewController(
        _ controller: MultiTabbedViewController,
        didRequestCloseTab id: UUID,
        on edge: Edge
    )

    /// User dragged a tab on `edge` to a new position within that edge.
    /// Already applied to the edge's tab list.
    func multiTabbedViewController(
        _ controller: MultiTabbedViewController,
        didReorderTab id: UUID,
        to index: Int,
        on edge: Edge
    )
}

extension MultiTabbedViewControllerDelegate {
    public func multiTabbedViewControllerNeedsNewTab(_ controller: MultiTabbedViewController, on edge: Edge) {}
    public func multiTabbedViewController(
        _ controller: MultiTabbedViewController,
        didSelectTab id: UUID,
        on edge: Edge
    ) {}
    public func multiTabbedViewController(
        _ controller: MultiTabbedViewController,
        didRequestCloseTab id: UUID,
        on edge: Edge
    ) {
        controller.removeTab(id: id)
    }
    public func multiTabbedViewController(
        _ controller: MultiTabbedViewController,
        didReorderTab id: UUID,
        to index: Int,
        on edge: Edge
    ) {}
}
