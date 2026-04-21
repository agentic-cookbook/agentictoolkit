import Testing
import Foundation
@testable import AgenticToolkitPluginSDK

@Suite("PluginMetadata")
struct PluginMetadataTests {

    @Test("initializes with all fields")
    func initAllFields() {
        let url = URL(fileURLWithPath: "/tmp/test.bundle")
        let m = PluginMetadata(
            identifier: "com.test.plugin",
            displayName: "Test Plugin",
            version: "1.0.0",
            sdkVersion: "1",
            bundlePath: url
        )
        #expect(m.identifier == "com.test.plugin")
        #expect(m.displayName == "Test Plugin")
        #expect(m.version == "1.0.0")
        #expect(m.sdkVersion == "1")
        #expect(m.bundlePath == url)
    }

    @Test("currentSDKVersion is 1")
    func sdkVersion() {
        #expect(PluginMetadata.currentSDKVersion == "1")
    }
}
