import Foundation
import AgenticPluginSDK

/// Registry of all built-in plugin types.
///
/// Since built-in plugins are compiled into the host app (not loaded as external
/// bundles), they need to be registered manually with the `PluginManager`.
/// This registry provides the list of all available built-in plugin types.
public enum BuiltInPluginRegistry {

    /// All built-in plugin types, in display order.
    public static let allPluginTypes: [AgenticLLMPlugin.Type] = [
        ClaudeLocalPlugin.self,
        ClaudeAPIPlugin.self,
        OpenAIPlugin.self,
        GooglePlugin.self,
        OpenAICompatiblePlugin.self,
    ]
}
