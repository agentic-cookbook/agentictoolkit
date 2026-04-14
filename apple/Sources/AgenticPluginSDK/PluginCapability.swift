import Foundation

/// Capability flags advertised by an LLM plugin.
public struct PluginCapability: OptionSet, Sendable {
    public let rawValue: Int

    public init(rawValue: Int) {
        self.rawValue = rawValue
    }

    public static let textCompletion  = PluginCapability(rawValue: 1 << 0)
    public static let streaming       = PluginCapability(rawValue: 1 << 1)
    public static let vision          = PluginCapability(rawValue: 1 << 2)
    public static let functionCalling = PluginCapability(rawValue: 1 << 3)
}
