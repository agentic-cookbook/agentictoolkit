import Testing
@testable import AgenticToolkitAIPluginsCore

@Suite("AIPluginCapability")
struct PluginCapabilityTests {

    @Test("individual flags have distinct raw values")
    func distinctFlags() {
        let flags: [AIPluginCapability] = [.textCompletion, .streaming, .vision, .functionCalling]
        let rawValues = flags.map(\.rawValue)
        #expect(Set(rawValues).count == flags.count)
    }

    @Test("option set operations work")
    func optionSetOps() {
        let caps: AIPluginCapability = [.textCompletion, .streaming]
        #expect(caps.contains(.textCompletion))
        #expect(caps.contains(.streaming))
        #expect(!caps.contains(.vision))
    }
}
