import AppKit
import ApplicationServices

/// Diagnostic harness that attempts to activate a list of target windows using
/// a cascade of strategies (iTerm2 TTY matching, AX title matching, bring-app-to-front)
/// and logs detailed results. Intended for developer/QA use to diagnose why
/// a specific terminal window won't come to the front.
///
/// Not tied to any particular app or data source — callers build `WindowActivationTarget`
/// values from whatever they have (SQLite sessions, file paths, running processes).
public final class WindowActivationTester {

    private let targets: [WindowActivationTarget]
    private let log: ActivationTestLog

    public init(targets: [WindowActivationTarget], log: ActivationTestLog) {
        self.targets = targets
        self.log = log
    }

    // MARK: - Known Terminals

    /// A known terminal app the tester can enumerate and activate.
    /// Centralizes the mapping between `$TERM_PROGRAM` values and macOS bundle IDs.
    private struct TerminalApp {
        let displayName: String
        let bundleID: String
        /// The values of `$TERM_PROGRAM` that identify this terminal (may be multiple).
        let termProgramValues: [String]

        static let allKnown: [TerminalApp] = [
            TerminalApp(displayName: "iTerm2",
                        bundleID: "com.googlecode.iterm2",
                        termProgramValues: ["iTerm.app"]),
            TerminalApp(displayName: "Terminal.app",
                        bundleID: "com.apple.Terminal",
                        termProgramValues: ["Apple_Terminal"]),
            TerminalApp(displayName: "Warp",
                        bundleID: "dev.warp.Warp-Stable",
                        termProgramValues: ["WarpTerminal"]),
            TerminalApp(displayName: "VS Code",
                        bundleID: "com.microsoft.VSCode",
                        termProgramValues: ["vscode"]),
        ]

        static func match(termProgram: String) -> TerminalApp? {
            allKnown.first { $0.termProgramValues.contains(termProgram) }
        }
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
        for term in TerminalApp.allKnown {
            guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: term.bundleID).first else {
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
        if let result = runAppleScript(script) {
            log.append(result)
        } else {
            log.append("  (AppleScript failed)")
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

        let tty = ttyForPid(target.pid)
        log.append("  tty: \(tty ?? "UNKNOWN")")

        let termApp = target.termProgram.isEmpty ? "unknown" : target.termProgram
        var activated = false

        // Strategy A: iTerm2 — use AppleScript to select by TTY
        if termApp == "iTerm.app" || termApp == "unknown" {
            if let tty = tty {
                activated = activateITermByTTY(tty: tty)
                log.append("  Strategy A (iTerm TTY): \(activated ? "SUCCESS" : "FAILED")")
            }
        }

        // Strategy B: AX matching by window title containing project name or cwd
        if !activated {
            activated = activateByAXTitleMatch(target: target)
            log.append("  Strategy B (AX title match): \(activated ? "SUCCESS" : "FAILED")")
        }

        // Strategy C: Just bring the terminal app to front
        if !activated {
            activated = activateTerminalApp(termProgram: termApp)
            log.append("  Strategy C (bring app to front): \(activated ? "SUCCESS" : "FAILED")")
        }

        // Verify
        Thread.sleep(forTimeInterval: 0.5)
        let frontTitle = frontmostWindowTitle()
        log.append("  After activation: frontmost=\"\(frontTitle)\"")

        let verified = !frontTitle.isEmpty && frontTitle != "Sessions"
        log.append("  Result: \(verified ? "PASS" : "FAIL")")
        return verified
    }

    // MARK: - Strategy A: iTerm2 TTY Matching

    private func activateITermByTTY(tty: String) -> Bool {
        let devTTY = tty.hasPrefix("/dev/") ? tty : "/dev/\(tty)"

        let script = """
        tell application "iTerm2"
            repeat with w in windows
                repeat with t in tabs of w
                    set s to current session of t
                    if tty of s is "\(devTTY)" then
                        select t
                        activate
                        return "found"
                    end if
                end repeat
            end repeat
            return "not_found"
        end tell
        """

        guard let result = runAppleScript(script) else {
            log.append("  iTerm TTY script failed")
            return false
        }

        if result.trimmingCharacters(in: .whitespacesAndNewlines) == "found" {
            return true
        }

        log.append("  TTY \(devTTY) not directly found in iTerm, trying parent lookup")
        return false
    }

    // MARK: - Strategy B: AX Title Match

    private func activateByAXTitleMatch(target: WindowActivationTarget) -> Bool {
        let projectName = target.projectName
        let cwdLast = (target.cwd as NSString).lastPathComponent

        guard projectName != "Unknown" else { return false }

        for app in NSWorkspace.shared.runningApplications {
            guard app.activationPolicy == .regular else { continue }
            let axApp = AXUIElementCreateApplication(app.processIdentifier)
            var windowsRef: CFTypeRef?
            guard AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &windowsRef) == .success,
                  let windows = windowsRef as? [AXUIElement] else { continue }

            for window in windows {
                var titleRef: CFTypeRef?
                AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef)
                guard let title = titleRef as? String, !title.isEmpty else { continue }

                let matches = title.localizedCaseInsensitiveContains(projectName)
                    || title.localizedCaseInsensitiveContains(cwdLast)
                    || title.localizedCaseInsensitiveContains(target.cwd)

                if matches {
                    log.append("  AX match: \"\(title)\" in \(app.localizedName ?? "?")")
                    app.activate()
                    Thread.sleep(forTimeInterval: 0.15)
                    AXUIElementPerformAction(window, kAXRaiseAction as CFString)
                    AXUIElementSetAttributeValue(window, kAXMainAttribute as CFString, true as CFTypeRef)
                    return true
                }
            }
        }
        return false
    }

    // MARK: - Strategy C: Bring App to Front

    private func activateTerminalApp(termProgram: String) -> Bool {
        guard let term = TerminalApp.match(termProgram: termProgram),
              let app = NSRunningApplication.runningApplications(withBundleIdentifier: term.bundleID).first else {
            return false
        }
        app.activate()
        return true
    }

    // MARK: - Helpers

    private func ttyForPid(_ pid: Int32) -> String? {
        guard pid > 0 else { return nil }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/ps")
        process.arguments = ["-p", "\(pid)", "-o", "tty="]
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let tty = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return tty.isEmpty ? nil : tty
        } catch {
            return nil
        }
    }

    private func frontmostWindowTitle() -> String {
        guard let frontApp = NSWorkspace.shared.frontmostApplication else { return "" }
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

    private func runAppleScript(_ source: String) -> String? {
        guard let script = NSAppleScript(source: source) else {
            log.append("  AppleScript compile failed (malformed source)")
            return nil
        }
        var error: NSDictionary?
        let result = script.executeAndReturnError(&error)
        if let error {
            let message = error[NSAppleScript.errorMessage] as? String ?? "unknown error"
            let number = error[NSAppleScript.errorNumber] as? Int ?? 0
            log.append("  AppleScript failed: \(message) (error \(number))")
            return nil
        }
        return result.stringValue
    }
}
