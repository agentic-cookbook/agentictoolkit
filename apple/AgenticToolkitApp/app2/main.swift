import AppKit

//// Single-instance enforcement (skip during unit tests).
//let isRunningTests = ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
//if !isRunningTests {
//    let myBundleID = Bundle.main.bundleIdentifier ?? "com.mikefullerton.AgenticPluginTester"
//    let running = NSRunningApplication.runningApplications(withBundleIdentifier: myBundleID)
//    if running.count > 1 {
//        for app in running where app != NSRunningApplication.current {
//            app.activate()
//        }
//        exit(0)
//    }
//}
//
//let app = NSApplication.shared
//// NSApplication.delegate is weak; hold a strong module-scope reference so
//// the delegate survives past the assumeIsolated block.
//let delegate = MainActor.assumeIsolated { AppDelegate() }
//app.delegate = delegate
//app.run()

import AppKit

// MARK: - App Delegate
//@MainActor
final class AppDelegate2: NSObject, NSApplicationDelegate {
    private var window: NSWindow!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let contentRect = NSRect(x: 0, y: 0, width: 640, height: 400)
        let style: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable]

        window = NSWindow(
            contentRect: contentRect,
            styleMask: style,
            backing: .buffered,
            defer: false
        )
        window.title = "AppKit Example"
        window.center()
        window.setFrameAutosaveName("MainWindow")

        // Root content view
        let contentView = NSView(frame: contentRect)
        contentView.wantsLayer = true
        contentView.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor

        // A label
        let label = NSTextField(labelWithString: "Hello from AppKit 👋")
        label.font = .systemFont(ofSize: 24, weight: .semibold)
        label.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(label)

        // A button
        let button = NSButton(title: "Click Me", target: self, action: #selector(handleClick(_:)))
        button.bezelStyle = .rounded
        button.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(button)

        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: contentView.centerYAnchor, constant: -20),

            button.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            button.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 20),
        ])

        window.contentView = contentView
        window.makeKeyAndOrderFront(nil)

        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    @objc private func handleClick(_ sender: NSButton) {
        let alert = NSAlert()
        alert.messageText = "Button clicked"
        alert.informativeText = "This is a pure AppKit app — no SwiftUI in sight."
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
}

// MARK: - Entry point

let app = NSApplication.shared
let delegate = AppDelegate2()
app.delegate = MainActor.assumeIsolated { AppDelegate2() }

app.run()
