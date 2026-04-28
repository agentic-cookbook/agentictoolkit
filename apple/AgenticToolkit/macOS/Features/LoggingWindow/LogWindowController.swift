import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// `SingleWindowController` that hosts a ``LogViewController`` backed
/// by a caller-supplied ``LogController``. Handles the AppKit window
/// shell (title, size, style mask, frame persistence via
/// `WindowManager`) so callers only need a log source.
///
/// Subclasses can override ``makeContentViewController()`` to swap in a
/// `LogViewController` subclass that contributes extra toolbar items.
/// Callers that want singleton semantics layer their own static on top
/// — this base intentionally stays non-singleton.
@MainActor
open class LogWindowController: SingleWindowController {
    public let controller: any LogController

    public init(windowID: String, controller: any LogController) {
        self.controller = controller
        super.init(windowID: windowID)
    }

    open override var windowTitle: String { "Log" }

    open override var defaultContentRect: NSRect {
        NSRect(x: 0, y: 0, width: 900, height: 600)
    }

    open override var windowStyleMask: NSWindow.StyleMask {
        [.titled, .closable, .resizable, .miniaturizable]
    }

    open override func makeContentViewController() -> NSViewController? {
        LogViewController(controller: controller)
    }
}
