import AppKit
import AgenticToolkitCoreUI

/// Manages a standalone AI Chat window. Callers build their own
/// `ChatViewModel` with whichever backend is appropriate (stub, live
/// plugin-backed, etc.) and hand it off at init.
@MainActor
public final class AIChatWindowController: SingleWindowController {

    private let viewModel: ChatViewModel

    public init(viewModel: ChatViewModel, windowID: String = "aiChat") {
        self.viewModel = viewModel
        super.init(windowID: windowID)
    }

    public override var windowTitle: String { "AI Chat" }

    public override var defaultContentRect: NSRect {
        NSRect(x: 0, y: 0, width: 420, height: 520)
    }

    public override var windowStyleMask: NSWindow.StyleMask {
        [.titled, .closable, .miniaturizable, .resizable]
    }

    public override func makeContentView() -> NSView? {
        ChatView(viewModel: viewModel)
    }
}
