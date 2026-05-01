import Foundation

/// A single message in an LLM conversation.
///
/// Tool turns are carried in `.toolUse` / `.toolResult` cases, which use
/// the optional payload fields below for their associated data. The legacy
/// String raw values are preserved for plugins that pass through `role.rawValue`
/// directly into their wire format.
public struct AIPluginMessage: Sendable {
    public let role: Role
    public let content: String
    public let toolUseId: String?
    public let toolName: String?
    public let toolArgumentsJSON: Data?
    public let toolIsError: Bool?

    public enum Role: String, Sendable {
        case user
        case assistant
        case system
        case toolUse = "tool_use"
        case toolResult = "tool_result"
    }

    public init(role: Role, content: String) {
        self.init(
            role: role,
            content: content,
            toolUseId: nil,
            toolName: nil,
            toolArgumentsJSON: nil,
            toolIsError: nil
        )
    }

    private init(
        role: Role,
        content: String,
        toolUseId: String?,
        toolName: String?,
        toolArgumentsJSON: Data?,
        toolIsError: Bool?
    ) {
        self.role = role
        self.content = content
        self.toolUseId = toolUseId
        self.toolName = toolName
        self.toolArgumentsJSON = toolArgumentsJSON
        self.toolIsError = toolIsError
    }

    public static func toolUse(id: String, name: String, argumentsJSON: Data) -> AIPluginMessage {
        AIPluginMessage(
            role: .toolUse,
            content: "",
            toolUseId: id,
            toolName: name,
            toolArgumentsJSON: argumentsJSON,
            toolIsError: nil
        )
    }

    public static func toolResult(id: String, content: String, isError: Bool) -> AIPluginMessage {
        AIPluginMessage(
            role: .toolResult,
            content: content,
            toolUseId: id,
            toolName: nil,
            toolArgumentsJSON: nil,
            toolIsError: isError
        )
    }
}
