import AppKit

@MainActor
private var coordinator: AIChatCoordinator? {
    NSApp.scriptingHost?.feature(AIChatCoordinator.self)
}

@objc(ShowAIChatCommand)
public final class ShowAIChatCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        coordinator?.showWindow()
        return nil
    }
}

@objc(HideAIChatCommand)
public final class HideAIChatCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        coordinator?.windowController?.dismiss()
        return nil
    }
}

@objc(SendChatMessageCommand)
public final class SendChatMessageCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        guard let text = directParameter as? String,
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            scriptErrorNumber = errOSACantAssign
            scriptErrorString = "Message text is required."
            return nil
        }
        guard let aiChat = coordinator else {
            scriptErrorNumber = errOSACantAssign
            scriptErrorString = "AI Chat is not available."
            return nil
        }
        aiChat.ensureWindow()
        guard let viewModel = aiChat.viewModel else {
            scriptErrorNumber = errOSACantAssign
            scriptErrorString = "Could not create chat view model."
            return nil
        }
        viewModel.sendMessage(text)
        return viewModel.messages.count
    }
}

@objc(GetChatMessagesCommand)
public final class GetChatMessagesCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        guard let viewModel = coordinator?.viewModel else { return [] }
        return viewModel.messages.map { msg -> String in
            let role: String
            switch msg.role {
            case .user:      role = "user"
            case .assistant: role = "assistant"
            case .error:     role = "error"
            }
            return "\(role): \(msg.text)"
        }
    }
}

@objc(ClearChatCommand)
public final class ClearChatCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        coordinator?.viewModel?.clearHistory()
        return nil
    }
}
