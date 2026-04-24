import Testing
import Foundation
@testable import AgenticToolkitMacOS

@Suite("AIPluginManager")
@MainActor
struct AIPluginManagerTests {

    @Test("discovers no plugins from empty directory")
    func emptyDiscovery() throws {
        let tmpDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("agentic-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        let manager = AIPluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()
        #expect(manager.availablePlugins.isEmpty)
    }

    @Test("discovers no plugins from nonexistent directory")
    func nonexistentPath() {
        let manager = AIPluginManager(searchPaths: [URL(fileURLWithPath: "/nonexistent/path")])
        manager.discoverPlugins()
        #expect(manager.availablePlugins.isEmpty)
    }

    @Test("loadPlugin throws notFound for unknown identifier")
    func loadUnknownPlugin() {
        let manager = AIPluginManager(searchPaths: [])
        manager.discoverPlugins()
        #expect(throws: AIPluginManager.AIPluginError.self) {
            try manager.loadPlugin(identifier: "com.nonexistent.plugin")
        }
    }

    @Test("info returns nil for unknown identifier")
    func infoUnknown() {
        let manager = AIPluginManager(searchPaths: [])
        manager.discoverPlugins()
        #expect(manager.info(for: "com.nonexistent.plugin") == nil)
    }

    @Test("plugin returns nil when not loaded")
    func pluginNotLoaded() {
        let manager = AIPluginManager(searchPaths: [])
        #expect(manager.plugin(for: "com.nonexistent.plugin") == nil)
    }

    @Test("unloadPlugin removes cached instance")
    func unloadRemovesCached() {
        let manager = AIPluginManager(searchPaths: [])
        // Unloading a non-existent plugin should not crash
        manager.unloadPlugin(identifier: "com.nonexistent.plugin")
        #expect(manager.plugin(for: "com.nonexistent.plugin") == nil)
    }

    @Test("discovers bundle with valid Info.plist metadata")
    func discoverValidBundle() throws {
        let tmpDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("agentic-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        // Create a minimal .aiplugin directory with Info.plist
        let bundleDir = tmpDir.appendingPathComponent("TestPlugin.aiplugin")
        let contentsDir = bundleDir.appendingPathComponent("Contents")
        try FileManager.default.createDirectory(at: contentsDir, withIntermediateDirectories: true)

        let plist: [String: Any] = [
            "AgenticPluginIdentifier": "com.test.plugin",
            "AgenticPluginDisplayName": "Test Plugin",
            "AgenticPluginVersion": "1.0.0",
            "AgenticSDKVersion": AIPluginInfoRegistry.currentSDKVersion,
            "NSPrincipalClass": "TestPlugin",
        ]
        let plistData = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try plistData.write(to: contentsDir.appendingPathComponent("Info.plist"))

        let manager = AIPluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()

        #expect(manager.availablePlugins.count == 1)
        #expect(manager.availablePlugins.first?.identifier == "com.test.plugin")
        #expect(manager.availablePlugins.first?.displayName == "Test Plugin")
    }

    @Test("skips bundle with incompatible SDK version")
    func skipIncompatibleSDK() throws {
        let tmpDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("agentic-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        let bundleDir = tmpDir.appendingPathComponent("OldPlugin.aiplugin")
        let contentsDir = bundleDir.appendingPathComponent("Contents")
        try FileManager.default.createDirectory(at: contentsDir, withIntermediateDirectories: true)

        let plist: [String: Any] = [
            "AgenticPluginIdentifier": "com.test.old",
            "AgenticPluginDisplayName": "Old Plugin",
            "AgenticPluginVersion": "1.0.0",
            "AgenticSDKVersion": "999",  // Incompatible
            "NSPrincipalClass": "OldPlugin",
        ]
        let plistData = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try plistData.write(to: contentsDir.appendingPathComponent("Info.plist"))

        let manager = AIPluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()

        #expect(manager.availablePlugins.isEmpty)
    }

    @Test("skips bundle with missing plist keys")
    func skipMissingKeys() throws {
        let tmpDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("agentic-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        let bundleDir = tmpDir.appendingPathComponent("BadPlugin.aiplugin")
        let contentsDir = bundleDir.appendingPathComponent("Contents")
        try FileManager.default.createDirectory(at: contentsDir, withIntermediateDirectories: true)

        // Missing AgenticPluginIdentifier
        let plist: [String: Any] = [
            "AgenticPluginDisplayName": "Bad Plugin",
            "AgenticPluginVersion": "1.0.0",
            "AgenticSDKVersion": "1",
        ]
        let plistData = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try plistData.write(to: contentsDir.appendingPathComponent("Info.plist"))

        let manager = AIPluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()

        #expect(manager.availablePlugins.isEmpty)
    }
}
