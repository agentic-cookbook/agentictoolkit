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

    init() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 440, height: 310))
        super.init(
            windowID: Self.windowID,
            contentViewController: WindowContentViewController<NSView>(contentView: container)
        )
        self.windowSpec = WindowSpec(
            defaultSize: NSSize(width: 440, height: 310),
            minSize: NSSize(width: 440, height: 310),
            defaultPosition: .center,
            persistsFrame: false
        )
        self.windowTitle = "Whippet Setup"
        self.windowStyleMask = [.titled]
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
