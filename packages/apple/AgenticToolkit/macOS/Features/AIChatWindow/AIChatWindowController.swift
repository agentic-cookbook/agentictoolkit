import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Manages a standalone AI Chat window. Callers build their own
/// `ChatViewModel` with whichever backend is appropriate (stub, live
/// plugin-backed, etc.) and hand it off at init.
@MainActor
public final class AIChatWindowController: WindowController<WindowContentViewController<ChatView>> {

    private let viewModel: ChatViewModel

    public static let windowID = "aiChat"

    public init(viewModel: ChatViewModel) {

        self.viewModel = viewModel
        super.init(
            windowID: Self.windowID,
            contentViewController: WindowContentViewController<ChatView>(contentView: ChatView(viewModel: viewModel))
        )

        self.windowSpec = WindowSpec(
            defaultSize: NSSize(width: 420, height: 520),
            minSize: NSSize(width: 320, height: 400),
            defaultPosition: .center,
            persistsFrame: true
        )
        self.windowTitle = "AI Chat"
        self.windowStyleMask = [.titled, .closable, .miniaturizable, .resizable]
    }
}
