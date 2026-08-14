import AppKit
import AIPluginKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The standalone "Chat" window — ``LLMChatViewController`` in an ordinary,
/// resizable window. One per app: re-showing it keeps the conversation rather than
/// starting a new one, which is the point of a window you leave open while you edit
/// a provider's settings beside it.
///
/// Deliberately *not* `SingletonWindowController`: that protocol's `makeShared()`
/// takes no arguments, and this window can't be built without an `AIPluginManager`.
/// It is likewise not registered as restorable — a chat window left open at quit
/// should not reopen itself with a dead transcript at the next launch.
@MainActor
public final class LLMChatWindowController: SingleWindowController {

    public private(set) static var current: LLMChatWindowController?

    public static let windowID = "llm-chat"

    private let content: LLMChatViewController

    /// Shows the window, creating it the first time.
    ///
    /// - Parameters:
    ///   - configuration: the provider to switch to, or `nil` to keep whatever the
    ///     window was already showing.
    ///   - model: the model to switch to, or `nil` for the provider's stored one.
    public static func present(pluginManager: AIPluginManager,
                               configuration: AIProviderConfiguration? = nil,
                               model: String? = nil) {
        if current == nil {
            current = LLMChatWindowController(pluginManager: pluginManager)
        }
        current?.content.refresh(selecting: configuration, model: model)
        current?.showWindow()
    }

    /// The transcript being driven, so automation can send/read messages the chat's
    /// own text field won't take synthetically.
    public var chatViewModel: ChatViewModel? { content.chatViewModel }

    /// The provider + model the window is currently pointed at.
    public var selection: LLMChatViewController.Selection? { content.selection }

    public override func close() {
        window?.performClose(nil)
    }

    private init(pluginManager: AIPluginManager) {
        let content = LLMChatViewController(pluginManager: pluginManager)
        self.content = content
        super.init(windowID: Self.windowID, contentViewController: content)
        self.windowTitle = "LLM Chat"
        self.windowStyleMask = [.titled, .closable, .miniaturizable, .resizable]
        self.windowSpec = WindowSpec(
            defaultSize: content.initialContentSize,
            minSize: NSSize(width: 420, height: 420),
            defaultPosition: .center,
            behavior: [.persistsFrame]
        )
    }
}
