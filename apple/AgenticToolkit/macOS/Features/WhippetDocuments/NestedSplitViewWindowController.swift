import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS


/// Document window for `.whiproj` packages. All document windows share a
/// single `WindowManager` spec so frame geometry persists in the app
/// preferences (not per-document) — content layout lives in the package's
/// SQLite.
@MainActor
public final class NestedSplitViewWindowController: WindowController<NSViewController> {

    public static let sharedWindowID = "whiprojDocumentWindow"

    private let splitDocument: NestedSplitViewDocument

    public init(document: NestedSplitViewDocument) {
        self.splitDocument = document

        let content = NestingSplitViewController.make(
            from: document.initialLayout(),
            document: document,
            isRoot: true
        )
        super.init(windowID: Self.sharedWindowID, contentViewController: content)

        self.windowSpec = WindowSpec(
            defaultSize: NSSize(width: 800, height: 500),
            minSize: NSSize(width: 400, height: 300),
            defaultPosition: .center,
            persistsFrame: true
        )
        self.windowTitle = document.displayName ?? "Untitled"
        self.windowStyleMask = [.titled, .closable, .resizable, .miniaturizable]
        self.minSize = NSSize(width: 400, height: 300)
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
