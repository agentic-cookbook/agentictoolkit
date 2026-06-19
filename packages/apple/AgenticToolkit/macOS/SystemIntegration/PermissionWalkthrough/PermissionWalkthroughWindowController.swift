import AgenticToolkitCoreUI
import AppKit
import AgenticToolkitCoreMacOS

/// Hosts the permission walkthrough UI. Content is rebuilt per-permission
/// by `PermissionWalkthrough`, which reuses `contentContainer` as its
/// drawing surface.
@MainActor
final class PermissionWalkthroughWindowController: WindowController<WindowContentViewController<NSView>> {

    var contentContainer: NSView {
        viewController?.contentView ?? NSView()
    }

    static let windowID = "permissionWalkthrough"

    /// `title` is injected by the caller so this shared framework doesn't bake in a
    /// product name. The window is resizable and tall enough for the full set of
    /// permission cards so content can't clip; it is intentionally not closable —
    /// "Done" is the only exit, which guarantees the completion handler runs.
    init(title: String = "Permissions") {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 460, height: 480))
        super.init(
            windowID: Self.windowID,
            contentViewController: WindowContentViewController<NSView>(contentView: container)
        )
        self.windowSpec = WindowSpec(
            defaultSize: NSSize(width: 460, height: 480),
            minSize: NSSize(width: 460, height: 360),
            defaultPosition: .center,
            persistsFrame: false
        )
        self.windowTitle = title
        self.windowStyleMask = [.titled, .resizable]
    }

    override func configureWindow(_ window: NSWindow) {
        window.level = .floating
    }

    func present() {
        // NSWindowController.init(window: nil) marks the controller as
        // already loaded, so showWindow() never triggers loadWindow().
        // Force it here on first show.
        if window == nil {
            loadWindow()
        }
        showWindow()
    }
}
