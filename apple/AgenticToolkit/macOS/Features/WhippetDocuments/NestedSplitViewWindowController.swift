import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS


/// Document window for `.whiproj` packages. All document windows share a
/// single `WindowManager` spec so frame geometry persists in the app
/// preferences (not per-document) — content layout lives in the package's
/// SQLite.
@MainActor
public final class NestedSplitViewWindowController: SingleWindowController {

    public static let sharedWindowID = "whiprojDocumentWindow"

    private let splitDocument: NestedSplitViewDocument

    public init(document: NestedSplitViewDocument) {
        self.splitDocument = document
        super.init(windowID: Self.sharedWindowID)
    }

    public override var windowTitle: String { splitDocument.displayName ?? "Untitled" }

    public override var defaultContentRect: NSRect {
        NSRect(x: 0, y: 0, width: 800, height: 500)
    }

    public override var windowStyleMask: NSWindow.StyleMask {
        [.titled, .closable, .resizable, .miniaturizable]
    }

    public override var minSize: NSSize? { NSSize(width: 400, height: 300) }

    public override func makeContentViewController() -> NSViewController? {
        NestingSplitViewController.make(
            from: splitDocument.initialLayout(),
            document: splitDocument,
            isRoot: true
        )
    }

    public override func showWindow(_ sender: Any?) {
        // `NSWindowController.init(window: nil)` (which SingleWindowController
        // chains into) leaves `isWindowLoaded = true`, so the default
        // `showWindow(_:)` never calls `loadWindow()`. Force it here so
        // `NSDocument.showWindows()` actually produces a visible window.
        if window == nil { loadWindow() }
        super.showWindow(sender)
    }
}
