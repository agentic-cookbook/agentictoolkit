import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Manages a standalone AI Chat window. Callers build their own
/// `ChatViewModel` with whichever backend is appropriate (stub, live
/// plugin-backed, etc.) and hand it off at init.
@MainActor
public final class AIChatWindowController: SingleWindowController {

    private let viewModel: ChatViewModel

    public static let windowID = "aiChat"
    public static let windowSpec = WindowSpec(
        defaultSize: NSSize(width: 420, height: 520),
        minSize: NSSize(width: 320, height: 400),
        defaultPosition: .center,
        persistsFrame: true
    )

    public init(viewModel: ChatViewModel, windowID: String = AIChatWindowController.windowID) {
        self.viewModel = viewModel
        super.init(windowID: windowID, spec: Self.windowSpec)
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

