import AgenticToolkitCoreUI
import AppKit
import AgenticToolkitCoreMacOS

/// Hosts the permission walkthrough UI. Content is rebuilt per-permission
/// by `PermissionWalkthrough`, which reuses `contentContainer` as its
/// drawing surface.
@MainActor
final class PermissionWalkthroughWindowController: SingleWindowController {

    let contentContainer = NSView(frame: NSRect(x: 0, y: 0, width: 440, height: 310))

    init() {
        super.init(windowID: "permissionWalkthrough")
    }

    override var windowTitle: String { "Whippet Setup" }

    override var defaultContentRect: NSRect {
        NSRect(x: 0, y: 0, width: 440, height: 310)
    }

    override var windowStyleMask: NSWindow.StyleMask { [.titled] }

    override func makeContentView() -> NSView? { contentContainer }

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
