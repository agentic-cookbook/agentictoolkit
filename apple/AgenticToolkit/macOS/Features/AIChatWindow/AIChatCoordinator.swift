import AppKit
import OSLog
import AgenticToolkitCore

/// Owns the AI Chat window. Lazy: nothing is constructed until
/// `showWindow()` is called or scripting reads `aiChatVisible`. The chat
/// backend is host-specific (Whippet uses `WhippetChatBackend`), so the
/// coordinator takes a backend-factory closure at init.
@MainActor
public final class AIChatCoordinator: AppFeature {

    private let makeBackend: () -> ChatBackend
    public private(set) var viewModel: ChatViewModel?
    public private(set) var windowController: AIChatWindowController?

    public init(makeBackend: @escaping () -> ChatBackend) {
        self.makeBackend = makeBackend
        super.init()
        
        self.menuContributions = [
            MenuContribution(slot: .window, title: "AI Chat", order: 30, key: "3") { [weak self] in
                self?.showWindow()
            },
            MenuContribution(slot: .statusItem(section: 1), title: "AI Chat", order: 20) { [weak self] in
                self?.showWindow()
            },
        ]
        
        self.scriptingKeys.insert("scriptingAIChatVisible")
        self.scriptingKeys.insert("scriptingChatViewModel")
    }

    // MARK: - Public API

    /// Idempotent — safe to call before reading `viewModel` from scripting.
    public func ensureWindow() {
        guard windowController == nil else { return }
        let backend = makeBackend()
        let vm = ChatViewModel(backend: backend)
        viewModel = vm
        windowController = AIChatWindowController(viewModel: vm)
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
