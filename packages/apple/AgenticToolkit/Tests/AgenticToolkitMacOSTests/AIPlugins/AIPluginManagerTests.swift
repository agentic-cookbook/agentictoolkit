import Testing
import Foundation
@testable import AIPluginKit
@testable import AgenticToolkitMacOS

@Suite("AIPluginManager")
@MainActor
struct AIPluginManagerTests {

    // MARK: - Helpers

    /// Writes a `.aiplugin` bundle whose only content is a `descriptor.json`
    /// resource. It passes discovery (the descriptor reads cleanly) but has no
    /// executable, so any *load* attempt fails — exactly the failure path
    /// `loadAllPlugins` must tolerate.
    @discardableResult
    private func writeDescriptorBundle(
        in dir: URL,
        id: String,
        name: String,
        schemaVersion: Int = AIPluginDescriptor.currentSchemaVersion
    ) throws -> URL {
        let bundleDir = dir.appendingPathComponent("\(name).aiplugin")
        let resourcesDir = bundleDir.appendingPathComponent("Contents").appendingPathComponent("Resources")
        try FileManager.default.createDirectory(at: resourcesDir, withIntermediateDirectories: true)

        let descriptor: [String: Any] = [
            "schemaVersion": schemaVersion,
            "identifier": id,
            "displayName": name,
            "version": "1.0.0",
            "models": ["test-model"],
            "fields": []
        ]
        let data = try JSONSerialization.data(withJSONObject: descriptor)
        try data.write(to: resourcesDir.appendingPathComponent("descriptor.json"))
        return bundleDir
    }

    private func makeTempDir() throws -> URL {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("agentic-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    // MARK: - Discovery

    @Test("discovers no plugins from empty directory")
    func emptyDiscovery() throws {
        let tmpDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        let manager = AIPluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()
        #expect(manager.descriptors.isEmpty)
    }

    @Test("discovers no plugins from nonexistent directory")
    func nonexistentPath() {
        let manager = AIPluginManager(searchPaths: [URL(fileURLWithPath: "/nonexistent/path")])
        manager.discoverPlugins()
        #expect(manager.descriptors.isEmpty)
    }

    @Test("discovers a bundle with a valid descriptor.json")
    func discoverValidBundle() throws {
        let tmpDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        try writeDescriptorBundle(in: tmpDir, id: "com.test.plugin", name: "Test Plugin")

        let manager = AIPluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()

        #expect(manager.descriptors.count == 1)
        #expect(manager.descriptors.first?.identifier == "com.test.plugin")
        #expect(manager.descriptors.first?.displayName == "Test Plugin")
    }

    @Test("skips a bundle with an incompatible schema version")
    func skipIncompatibleSchema() throws {
        let tmpDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        try writeDescriptorBundle(in: tmpDir, id: "com.test.old", name: "Old Plugin", schemaVersion: 999)

        let manager = AIPluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()

        #expect(manager.descriptors.isEmpty)
    }

    @Test("skips a bundle with no descriptor.json")
    func skipMissingDescriptor() throws {
        let tmpDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        // A bundle directory with only an Info.plist — no descriptor resource.
        let contentsDir = tmpDir
            .appendingPathComponent("NoDescriptor.aiplugin")
            .appendingPathComponent("Contents")
        try FileManager.default.createDirectory(at: contentsDir, withIntermediateDirectories: true)
        let plistData = try PropertyListSerialization.data(
            fromPropertyList: ["CFBundleIdentifier": "com.test.nodesc"], format: .xml, options: 0
        )
        try plistData.write(to: contentsDir.appendingPathComponent("Info.plist"))

        let manager = AIPluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()

        #expect(manager.descriptors.isEmpty)
    }

    // MARK: - Query

    @Test("loadPlugin throws notFound for unknown identifier")
    func loadUnknownPlugin() {
        let manager = AIPluginManager(searchPaths: [])
        manager.discoverPlugins()
        #expect(throws: AIPluginManager.AIPluginError.self) {
            try manager.loadPlugin(identifier: "com.nonexistent.plugin")
        }
    }

    @Test("descriptor returns nil for unknown identifier")
    func descriptorUnknown() {
        let manager = AIPluginManager(searchPaths: [])
        manager.discoverPlugins()
        #expect(manager.descriptor(for: "com.nonexistent.plugin") == nil)
    }

    @Test("plugin returns nil when not loaded")
    func pluginNotLoaded() {
        let manager = AIPluginManager(searchPaths: [])
        #expect(manager.plugin(for: "com.nonexistent.plugin") == nil)
    }

    @Test("unloadPlugin removes cached instance")
    func unloadRemovesCached() {
        let manager = AIPluginManager(searchPaths: [])
        // Unloading a non-existent plugin should not crash.
        manager.unloadPlugin(identifier: "com.nonexistent.plugin")
        #expect(manager.plugin(for: "com.nonexistent.plugin") == nil)
    }

    // MARK: - Resilient loading

    @Test("loadAllPlugins reports a failure without throwing")
    func loadAllReportsFailure() throws {
        let tmpDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        try writeDescriptorBundle(in: tmpDir, id: "com.test.broken", name: "Broken")

        let manager = AIPluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()
        #expect(manager.descriptors.count == 1)

        let result = manager.loadAllPlugins()
        #expect(result.loaded.isEmpty)
        #expect(result.failures.count == 1)
        #expect(result.failures.first?.identifier == "com.test.broken")
    }

    @Test("loadAllPlugins continues past a failing plugin")
    func loadAllContinuesPastFailure() throws {
        let tmpDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        try writeDescriptorBundle(in: tmpDir, id: "com.test.broken1", name: "BrokenOne")
        try writeDescriptorBundle(in: tmpDir, id: "com.test.broken2", name: "BrokenTwo")

        let manager = AIPluginManager(searchPaths: [tmpDir])
        manager.discoverPlugins()
        #expect(manager.descriptors.count == 2)

        let result = manager.loadAllPlugins()
        #expect(result.loaded.isEmpty)
        // Both failures present proves the loop did not abort after the first.
        #expect(result.failures.count == 2)
    }

    @Test("loadAllPlugins returns an empty result when nothing is discovered")
    func loadAllEmpty() {
        let manager = AIPluginManager(searchPaths: [])
        manager.discoverPlugins()

        let result = manager.loadAllPlugins()
        #expect(result.loaded.isEmpty)
        #expect(result.failures.isEmpty)
    }
}
