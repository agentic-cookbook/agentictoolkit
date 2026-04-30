import AppKit
import Foundation

/// Hosts of `TabbedViewController` implement this protocol to react to user
/// actions on the tab bar — adding new tabs, switching tabs, closing tabs,
/// reordering tabs. The host is responsible for providing the new tab's
/// content view controller (via `addTab(_:)` or `insertTab(_:at:)` from inside
/// `tabbedViewControllerNeedsNewTab(_:)`) — `TabbedViewController` itself
/// stays decoupled from any specific content type.
@MainActor
public protocol TabbedViewControllerDelegate: AnyObject {

    /// User triggered "New Tab" (e.g. via the File menu). The host should
    /// build a content view controller and call `addTab(_:)` on the
    /// `TabbedViewController`.
    func tabbedViewControllerNeedsNewTab(_ controller: TabbedViewController)

    /// The active tab changed. Always called when the selection moves —
    /// programmatic or user-driven.
    func tabbedViewController(_ controller: TabbedViewController, didSelectTab id: UUID)

    /// User clicked the close button on a tab. The host can veto by simply
    /// not calling `removeTab(id:)` in response. By default the host should
    /// honor the request unless this is the last tab in the bar.
    func tabbedViewController(_ controller: TabbedViewController, didRequestCloseTab id: UUID)

    /// User dragged a tab to a new position. Already applied to `tabs`.
    func tabbedViewController(_ controller: TabbedViewController, didReorderTab id: UUID, to index: Int)
}

extension TabbedViewControllerDelegate {
    public func tabbedViewControllerNeedsNewTab(_ controller: TabbedViewController) {}
    public func tabbedViewController(_ controller: TabbedViewController, didSelectTab id: UUID) {}
    public func tabbedViewController(_ controller: TabbedViewController, didRequestCloseTab id: UUID) {
        controller.removeTab(id: id)
    }
    public func tabbedViewController(_ controller: TabbedViewController, didReorderTab id: UUID, to index: Int) {}
}
