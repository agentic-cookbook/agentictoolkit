import AppKit
import OSLog
import AgenticToolkitCore

/// Owns the AI Chat window. Lazy: nothing is constructed until
/// `showWindow()` is called or scripting reads `aiChatVisible`. The chat
/// session is host-specific, so the coordinator takes a session-factory closure
/// at init.
@MainActor
public final class AIChatCoordinator: AppFeature {

    private let makeSession: () -> any ChatSession
    public private(set) var viewModel: ChatViewModel?
    public private(set) var windowController: AIChatWindowController?

    public init(makeSession: @escaping () -> any ChatSession) {
        self.makeSession = makeSession
        super.init()

        self.menuContributions = [
            MenuContribution(slot: .window, title: "AI Chat", order: 30, key: "3") { [weak self] in
                self?.showWindow()
            },
            MenuContribution(slot: .statusItem(section: 1), title: "AI Chat", order: 20) { [weak self] in
                self?.showWindow()
            }
        ]

        self.scriptingKeys.insert("scriptingAIChatVisible")
        self.scriptingKeys.insert("scriptingChatViewModel")
    }

    /// Legacy convenience: wraps a `ChatBackend` factory in the bridge adapter.
    @available(*, deprecated, message: "Pass makeSession: with a ChatSession (e.g. LocalChatSession).")
    public convenience init(makeBackend: @escaping () -> ChatBackend) {
        self.init(makeSession: { ChatBackendSession(backend: makeBackend()) })
    }

    // MARK: - Public API

    /// Idempotent — safe to call before reading `viewModel` from scripting.
    public func ensureWindow() {
        guard windowController == nil else { return }
        let chatViewModel = ChatViewModel(session: makeSession())
        viewModel = chatViewModel
        windowController = AIChatWindowController(viewModel: chatViewModel)
    }

    public func showWindow() {
        ensureWindow()
        windowController?.showWindow()
    }

    public override func value(forScriptingKey key: String) -> Any? {
        switch key {
        case "scriptingAIChatVisible":
            return windowController?.isVisible ?? false
        case "scriptingChatViewModel":
            return viewModel
        default:
            return nil
        }
    }

    public override func setValue(_ value: Any?, forScriptingKey key: String) {
        switch key {
        case "scriptingAIChatVisible":
            if (value as? Bool) == true { showWindow() }
        default:
            break
        }
    }
}

extension AIChatCoordinator: Loggable {
    public static nonisolated let logger = makeLogger()
}
