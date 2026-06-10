import Foundation

extension Notification.Name {

    /// Posted when the context picker panel is dismissed, so the host can clear
    /// its "picker visible" state. Posted by the host's picker panel; observed
    /// by the picker view's host.
    public static let contextPickerDismissed = Notification.Name("contextPickerDismissed")

    /// Posted when the discovery window becomes visible, so the window explorer
    /// can refresh its listing. Posted by the host's discovery window; observed
    /// by `DiscoveryView`.
    public static let discoveryPanelShown = Notification.Name("discoveryPanelShown")
}
