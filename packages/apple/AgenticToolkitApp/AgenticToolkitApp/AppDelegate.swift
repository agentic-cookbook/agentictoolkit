import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS
import AppKit

@MainActor
class AppDelegate: NSObject, NSApplicationDelegate {

    var features: Features?

    func applicationDidFinishLaunching(_ notification: Notification) {
        if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil {
            logger.info("Agentic Toolkit launching under XCTest — skipping app bootstrap")
            return
        }
        NSApp.setActivationPolicy(.regular)
        let features = Features()
        features.start()
        self.features = features
    }

    func applicationWillTerminate(_ notification: Notification) {
        features?.stop()
        features = nil
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool { false }

    func applicationShouldOpenUntitledFile(_ sender: NSApplication) -> Bool { false }
}

extension AppDelegate: Loggable {
    public static nonisolated let logger = makeLogger()
}
