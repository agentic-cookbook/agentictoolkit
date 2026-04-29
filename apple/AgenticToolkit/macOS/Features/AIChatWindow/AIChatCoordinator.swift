import AppKit
import OSLog
import AgenticToolkitCore

/// Owns the AI Chat window. Lazy: nothing is constructed until
/// `showWindow()` is called or scripting reads `aiChatVisible`. The chat
/// backend is host-specific (Whippet uses `WhippetChatBackend`), so the
/// coordinator takes a backend-factory closure at init.
@MainActor
public final class AIChatCoordinator: AppFeature, MenuContributor, ScriptingContributor {

    private let makeBackend: () -> ChatBackend
    public private(set) var viewModel: ChatViewModel?
    public private(set) var windowController: AIChatWindowController?

    public init(makeBackend: @escaping () -> ChatBackend) {
        self.makeBackend = makeBackend
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

    // MARK: - MenuContributor

    public func menuContributions() -> [MenuContribution] {
        [
            MenuContribution(slot: .window, title: "AI Chat", order: 30, key: "3") { [weak self] in
                self?.showWindow()
            },
            MenuContribution(slot: .statusItem(section: 1), title: "AI Chat", order: 20) { [weak self] in
                self?.showWindow()
            },
        ]
    }

    // MARK: - ScriptingContributor

    public var scriptingKeys: Set<String> { ["scriptingAIChatVisible", "scriptingChatViewModel"] }

    public func value(forScriptingKey key: String) -> Any? {
        switch key {
        case "scriptingAIChatVisible":
            return windowController?.isVisible ?? false
        case "scriptingChatViewModel":
            return viewModel
        default:
            return nil
        }
    }

    public func setValue(_ value: Any?, forScriptingKey key: String) {
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
