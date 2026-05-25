import AppKit
import AgenticToolkitMacOS

// Headless diagnostic: discover and load every plugin, then report and exit.
// Runs in the real app process so each plugin's `@rpath/AIPluginKit.framework`
// resolves to the host's embedded image — the same path the GUI uses to load
// plugins. Exits non-zero if any plugin failed to load (or none were found),
// so it doubles as a CI gate for the embed/link-not-embed wiring.
if CommandLine.arguments.contains("--verify-plugins") {
    let failed = MainActor.assumeIsolated { () -> Bool in
        let manager = AIPluginManager(appName: "AgenticPluginTester")
        manager.discoverPlugins()
        let discovered = manager.descriptors
        print("discovered \(discovered.count): \(discovered.map(\.identifier).joined(separator: ", "))")

        let result = manager.loadAllPlugins()
        let failedIDs = Set(result.failures.map(\.identifier))
        for descriptor in discovered where !failedIDs.contains(descriptor.identifier) {
            print("loaded: \(descriptor.identifier)")
        }
        for failure in result.failures {
            print("FAILED: \(failure.identifier): \(failure.message)")
        }
        print("verify-plugins: \(result.loaded.count) loaded, \(result.failures.count) failed")
        return !result.failures.isEmpty || result.loaded.isEmpty
    }
    exit(failed ? 1 : 0)
}

let isRunningTests = ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
if !isRunningTests {
    let myBundleID = Bundle.main.bundleIdentifier ?? "com.agentic-toolkit.app"
    let running = NSRunningApplication.runningApplications(withBundleIdentifier: myBundleID)
    if running.count > 1 {
        for app in running where app != NSRunningApplication.current {
            app.activate()
        }
        exit(0)
    }
}

let app = NSApplication.shared
let delegate = MainActor.assumeIsolated { AppDelegate() }
app.delegate = delegate
app.run()
