import AppKit

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
