import AppKit
import ApplicationServices
import AgenticToolkitScripting

/// Diagnostic harness that attempts to activate a list of target windows using
/// a cascade of `WindowActivationStrategy` implementations and logs detailed
/// results. Intended for developer/QA use to diagnose why a specific terminal
/// window won't come to the front.
///
/// Not tied to any particular app or data source — callers build
/// `WindowActivationTarget` values from whatever they have (SQLite sessions,
/// file paths, running processes).
public final class WindowActivationTester {

    private let targets: [WindowActivationTarget]
    private let strategies: [WindowActivationStrategy]
    private let log: ActivationTestLog
    private let runningApps: RunningAppsProvider

    /// Default cascade: iTerm-by-TTY → AX-title-match → bring-terminal-to-front.
    public static let defaultStrategies: [WindowActivationStrategy] = [
        ITermTTYStrategy(),
        AXTitleMatchStrategy(),
        BringTerminalToFrontStrategy(),
    ]

    public init(
        targets: [WindowActivationTarget],
        log: ActivationTestLog,
        strategies: [WindowActivationStrategy] = WindowActivationTester.defaultStrategies,
        runningApps: RunningAppsProvider = RealRunningAppsProvider()
    ) {
        self.targets = targets
        self.log = log
        self.strategies = strategies
        self.runningApps = runningApps
    }

    // MARK: - Run

    /// Runs activation tests against every target. Call from a background thread.
    /// Returns `(passed, failed)` counts.
    @discardableResult
    public func runAllTests() -> (passed: Int, failed: Int) {
        log.clear()
        log.append("=== Window Activation Test Harness ===")
        log.append("Accessibility: \(AXIsProcessTrusted() ? "GRANTED" : "DENIED")")

        guard AXIsProcessTrusted() else {
            log.append("ABORT: Accessibility permission required")
            return (0, 0)
        }

        log.append("Targets: \(targets.count)")
        log.append("Strategies: \(strategies.map(\.name).joined(separator: ", "))")
        log.append("")

        enumerateTerminalWindows()
        log.append("")

        var passed = 0
        var failed = 0

        for target in targets {
            let ok = testTarget(target)
            if ok { passed += 1 } else { failed += 1 }
            Thread.sleep(forTimeInterval: 1.0)
        }

        log.append("")
        log.append("=== Results: \(passed) passed, \(failed) failed ===")

        DispatchQueue.main.async {
            NSApp.activate(ignoringOtherApps: true)
        }
        return (passed, failed)
    }

    // MARK: - Enumerate Windows

    private func enumerateTerminalWindows() {
        log.append("--- Terminal Window Inventory ---")
        for term in KnownTerminals.all {
            guard let app = runningApps.runningApplications(withBundleIdentifier: term.bundleID).first else {
                log.append("\(term.displayName): not running")
                continue
            }
            log.append("\(term.displayName): PID=\(app.processIdentifier)")
            if term.bundleID == "com.googlecode.iterm2" {
                enumerateITermWindows()
            } else {
                enumerateAXWindows(for: app)
            }
        }
    }

    private func enumerateITermWindows() {
        let script = """
        tell application "iTerm2"
            set output to ""
            repeat with w in windows
                set wId to id of w
                set output to output & "  WINDOW id=" & wId & " name=" & name of w & linefeed
                set tabIdx to 0
                repeat with t in tabs of w
                    set tabIdx to tabIdx + 1
                    set s to current session of t
                    set output to output & "    TAB " & tabIdx & ": tty=" & tty of s & " name=" & name of s & linefeed
                end repeat
            end repeat
            return output
        end tell
        """
        switch AppleScriptRunner.run(script) {
        case .success(let value):
            log.append(value ?? "  (no output)")
        case .compileFailed:
            log.append("  (AppleScript compile failed)")
        case .runtimeFailed(let message, let number):
            log.append("  (AppleScript failed: \(message), error \(number))")
        }
    }

    private func enumerateAXWindows(for app: NSRunningApplication) {
        let axApp = AXUIElementCreateApplication(app.processIdentifier)
        var windowsRef: CFTypeRef?
        guard AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &windowsRef) == .success,
              let windows = windowsRef as? [AXUIElement] else {
            log.append("  (no AX windows)")
            return
        }

        for (i, window) in windows.enumerated() {
            var titleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef)
            let title = (titleRef as? String) ?? "<no title>"
            log.append("  AX[\(i)]: \"\(title)\"")
        }
    }

    // MARK: - Test One Target

    private func testTarget(_ target: WindowActivationTarget) -> Bool {
        log.append("--- Test: \(target.projectName) ---")
        log.append("  identifier: \(target.identifier)")
        log.append("  cwd: \(target.cwd)")
        log.append("  pid: \(target.pid)")
        log.append("  termProgram: \(target.termProgram)")

        var activated = false
        for strategy in strategies {
            guard !activated else {
                log.append("  Strategy \(strategy.name): skipped (already activated)")
                continue
            }
            guard strategy.appliesTo(target) else {
                log.append("  Strategy \(strategy.name): skipped (not applicable)")
                continue
            }
            let success = strategy.activate(target, log: log)
            log.append("  Strategy \(strategy.name): \(success ? "SUCCESS" : "FAILED")")
            if success { activated = true }
        }

        // Verify
        Thread.sleep(forTimeInterval: 0.5)
        let frontTitle = frontmostWindowTitle()
        log.append("  After activation: frontmost=\"\(frontTitle)\"")

        let verified = !frontTitle.isEmpty && frontTitle != "Sessions"
        log.append("  Result: \(verified ? "PASS" : "FAIL")")
        return verified
    }

    // MARK: - Helpers

    private func frontmostWindowTitle() -> String {
        guard let frontApp = runningApps.frontmostApplication else { return "" }
        if frontApp.bundleIdentifier == Bundle.main.bundleIdentifier { return "Sessions" }

        let axApp = AXUIElementCreateApplication(frontApp.processIdentifier)
        var windowRef: CFTypeRef?
        guard AXUIElementCopyAttributeValue(axApp, kAXFocusedWindowAttribute as CFString, &windowRef) == .success,
              let window = windowRef,
              CFGetTypeID(window) == AXUIElementGetTypeID() else { return "" }

        let axWindow = window as! AXUIElement  // Safe: verified via CFGetTypeID check above.
        var titleRef: CFTypeRef?
        AXUIElementCopyAttributeValue(axWindow, kAXTitleAttribute as CFString, &titleRef)
        return (titleRef as? String) ?? ""
    }
}
