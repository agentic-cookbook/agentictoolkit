import Foundation

/// A single message in the conversation history handed to a plugin.
public struct AIChatMessage: Sendable {

    public enum Role: String, Sendable {
        case system
        case user
        case assistant
        case toolUse = "tool_use"
        case toolResult = "tool_result"
    }

    public let role: Role
    public let content: String
    public let toolUseId: String?
    public let toolName: String?
    public let toolArgumentsJSON: Data?
    public let toolIsError: Bool?

    public init(
        role: Role,
        content: String,
        toolUseId: String? = nil,
        toolName: String? = nil,
        toolArgumentsJSON: Data? = nil,
        toolIsError: Bool? = nil
    ) {
        self.role = role
        self.content = content
        self.toolUseId = toolUseId
        self.toolName = toolName
        self.toolArgumentsJSON = toolArgumentsJSON
        self.toolIsError = toolIsError
    }
}

/// A tool the model may call. The plugin translates this into the provider's own
/// tool/function schema inside `buildRequest`.
public struct AIToolSpec: Sendable, Hashable {
    public let name: String
    public let description: String
    public let parametersJSONSchema: Data

    public init(name: String, description: String, parametersJSONSchema: Data) {
        self.name = name
        self.description = description
        self.parametersJSONSchema = parametersJSONSchema
    }
}

/// Resolved, ready-to-use configuration values for one request. The host reads
/// these from the plugin's settings schema and injects secrets (API keys) from
/// the Keychain just before calling `buildRequest`; the plugin never touches
/// storage itself.
public struct AIPluginConfig: Sendable {
    public let values: [String: String]

    public init(_ values: [String: String]) {
        self.values = values
    }

    public subscript(_ key: String) -> String? {
        values[key]
    }

    /// Convenience accessor for the conventional `apiKey` field.
    public var apiKey: String? { values["apiKey"] }

    /// Convenience accessor for the conventional `baseURL` field.
    public var baseURL: String? { values["baseURL"] }

    /// Convenience accessor for the conventional `model` field.
    public var model: String? { values["model"] }
}

/// Everything a plugin needs to build one chat request: the conversation, the
/// chosen model and limits, any tools the host wants exposed, and the resolved
/// configuration.
public struct AIChatContext: Sendable {
    public let messages: [AIChatMessage]
    public let model: String
    public let systemPrompt: String?
    public let maxTokens: Int
    public let tools: [AIToolSpec]
    public let config: AIPluginConfig

    public init(
        messages: [AIChatMessage],
        model: String,
        systemPrompt: String? = nil,
        maxTokens: Int = 4096,
        tools: [AIToolSpec] = [],
        config: AIPluginConfig
    ) {
        self.messages = messages
        self.model = model
        self.systemPrompt = systemPrompt
        self.maxTokens = maxTokens
        self.tools = tools
        self.config = config
    }
}
