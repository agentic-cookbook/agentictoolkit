import Testing
import Foundation
@testable import AgenticToolkitPluginSDK

@Suite("PluginManager")
@MainActor
struct PluginManagerTests {

    @Test("discovers no plugins from empty directory")
    func emptyDiscovery() throws {
        let tmpDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("agentic-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        let manager = PluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()
        #expect(manager.availablePlugins.isEmpty)
    }

    @Test("discovers no plugins from nonexistent directory")
    func nonexistentPath() {
        let manager = PluginManager(searchPaths: [URL(fileURLWithPath: "/nonexistent/path")])
        manager.discoverPlugins()
        #expect(manager.availablePlugins.isEmpty)
    }

    @Test("loadPlugin throws notFound for unknown identifier")
    func loadUnknownPlugin() {
        let manager = PluginManager(searchPaths: [])
        manager.discoverPlugins()
        #expect(throws: PluginManager.PluginError.self) {
            try manager.loadPlugin(identifier: "com.nonexistent.plugin")
        }
    }

    @Test("metadata returns nil for unknown identifier")
    func metadataUnknown() {
        let manager = PluginManager(searchPaths: [])
        manager.discoverPlugins()
        #expect(manager.metadata(for: "com.nonexistent.plugin") == nil)
    }

    @Test("plugin returns nil when not loaded")
    func pluginNotLoaded() {
        let manager = PluginManager(searchPaths: [])
        #expect(manager.plugin(for: "com.nonexistent.plugin") == nil)
    }

    @Test("unloadPlugin removes cached instance")
    func unloadRemovesCached() {
        let manager = PluginManager(searchPaths: [])
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

        // Create a minimal .bundle directory with Info.plist
        let bundleDir = tmpDir.appendingPathComponent("TestPlugin.bundle")
        let contentsDir = bundleDir.appendingPathComponent("Contents")
        try FileManager.default.createDirectory(at: contentsDir, withIntermediateDirectories: true)

        let plist: [String: Any] = [
            "AgenticPluginIdentifier": "com.test.plugin",
            "AgenticPluginDisplayName": "Test Plugin",
            "AgenticPluginVersion": "1.0.0",
            "AgenticSDKVersion": PluginMetadata.currentSDKVersion,
            "NSPrincipalClass": "TestPlugin",
        ]
        let plistData = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try plistData.write(to: contentsDir.appendingPathComponent("Info.plist"))

        let manager = PluginManager(searchPaths: [tmpDir])
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

        let bundleDir = tmpDir.appendingPathComponent("OldPlugin.bundle")
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

        let manager = PluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()

        #expect(manager.availablePlugins.isEmpty)
    }

    @Test("skips bundle with missing plist keys")
    func skipMissingKeys() throws {
        let tmpDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("agentic-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        let bundleDir = tmpDir.appendingPathComponent("BadPlugin.bundle")
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

        let manager = PluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()

        #expect(manager.availablePlugins.isEmpty)
    }
}
