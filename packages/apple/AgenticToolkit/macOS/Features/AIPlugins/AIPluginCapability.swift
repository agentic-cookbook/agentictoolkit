import Foundation

/// Capability flags advertised by an LLM plugin.
public struct AIPluginCapability: OptionSet, Sendable {
    public let rawValue: Int

    public init(rawValue: Int) {
        self.rawValue = rawValue
    }

    public static let textCompletion  = AIPluginCapability(rawValue: 1 << 0)
    public static let streaming       = AIPluginCapability(rawValue: 1 << 1)
    public static let vision          = AIPluginCapability(rawValue: 1 << 2)
    public static let functionCalling = AIPluginCapability(rawValue: 1 << 3)
}
