import AppKit
import ApplicationServices

/// A standalone test harness for window activation strategies.
/// Tests each live session by trying to activate its terminal window
/// and verifying the result. Logs detailed diagnostics.
final class WindowActivationTestHarness {

    private let databaseManager: DatabaseManager
    private let log = ActivationTestLog.shared

    init(databaseManager: DatabaseManager) {
        self.databaseManager = databaseManager
    }

    // MARK: - Run Tests

    /// Runs activation tests for all live sessions. Call from a background thread.
    func runAllTests() {
        log.clear()
        log.append("=== Window Activation Test Harness ===")
        log.append("Accessibility: \(AXIsProcessTrusted() ? "GRANTED" : "DENIED")")

        guard AXIsProcessTrusted() else {
            log.append("ABORT: Accessibility permission required")
            return
        }

        // Gather live sessions
        guard let sessions = try? databaseManager.fetchAllSessions() else {
            log.append("ABORT: Failed to fetch sessions")
            return
        }
        let liveSessions = sessions.filter { $0.status != .ended && $0.pid > 0 }

        log.append("Live sessions with PID: \(liveSessions.count)")
        log.append("")

        // Enumerate all terminal windows for reference
        enumerateTerminalWindows()
        log.append("")

        // Test each session
        var passed = 0
        var failed = 0

        for session in liveSessions {
            let result = testSession(session)
            if result {
                passed += 1
            } else {
                failed += 1
            }
            // Pause between tests to let activation settle
            Thread.sleep(forTimeInterval: 1.0)
        }

        log.append("")
        log.append("=== Results: \(passed) passed, \(failed) failed ===")

        // Bring AgenticToolkit back to front
        DispatchQueue.main.async {
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    // MARK: - Enumerate Windows

    /// Logs all terminal windows and their tabs for diagnostic reference.
    private func enumerateTerminalWindows() {
        log.append("--- Terminal Window Inventory ---")

        // iTerm2
        if let iterm = NSRunningApplication.runningApplications(withBundleIdentifier: "com.googlecode.iterm2").first {
            log.append("iTerm2: PID=\(iterm.processIdentifier)")
            enumerateITermWindows()
        } else {
            log.append("iTerm2: not running")
        }

        // Terminal.app
        if let terminal = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Terminal").first {
            log.append("Terminal.app: PID=\(terminal.processIdentifier)")
            enumerateAXWindows(for: terminal)
        } else {
            log.append("Terminal.app: not running")
        }

        // Warp
        if let warp = NSRunningApplication.runningApplications(withBundleIdentifier: "dev.warp.Warp-Stable").first {
            log.append("Warp: PID=\(warp.processIdentifier)")
            enumerateAXWindows(for: warp)
        } else {
            log.append("Warp: not running")
        }

        // VS Code
        if let vscode = NSRunningApplication.runningApplications(withBundleIdentifier: "com.microsoft.VSCode").first {
            log.append("VS Code: PID=\(vscode.processIdentifier)")
            enumerateAXWindows(for: vscode)
        } else {
            log.append("VS Code: not running")
        }
    }

    /// Uses iTerm2's AppleScript API to get detailed window/tab/TTY info.
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

    /// Uses AX API to enumerate windows for a given app.
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

    // MARK: - Test Individual Session

    /// Tests activation for a single session. Returns true if successful.
    private func testSession(_ session: Session) -> Bool {
        log.append("--- Test: \(session.projectName) ---")
        log.append("  session_id: \(session.sessionId)")
        log.append("  cwd: \(session.cwd)")
        log.append("  pid: \(session.pid)")
        log.append("  termProgram: \(session.termProgram)")

        // Step 1: Find the TTY for this session's PID
        let tty = ttyForPid(session.pid)
        log.append("  tty: \(tty ?? "UNKNOWN")")

        // Step 2: Determine which terminal app to target
        let termApp = session.termProgram.isEmpty ? "unknown" : session.termProgram

        // Step 3: Try activation strategies in order
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
            activated = activateByAXTitleMatch(session: session)
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

    /// Activates the iTerm2 tab whose session is on the given TTY.
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

        // The TTY might belong to a child process. Walk up the process tree
        // to find the shell session TTY.
        log.append("  TTY \(devTTY) not directly found in iTerm, trying parent lookup")
        return false
    }

    // MARK: - Strategy B: AX Title Match

    /// Searches all running apps for a window whose title matches the session.
    private func activateByAXTitleMatch(session: Session) -> Bool {
        let projectName = session.projectName
        let cwdLast = (session.cwd as NSString).lastPathComponent

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
                    || title.localizedCaseInsensitiveContains(session.cwd)

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

    /// Just activates the terminal app without selecting a specific window.
    private func activateTerminalApp(termProgram: String) -> Bool {
        let bundleIDs: [String: String] = [
            "iTerm.app": "com.googlecode.iterm2",
            "Apple_Terminal": "com.apple.Terminal",
            "WarpTerminal": "dev.warp.Warp-Stable",
            "vscode": "com.microsoft.VSCode",
        ]

        guard let bundleID = bundleIDs[termProgram],
              let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).first else {
            return false
        }

        app.activate()
        return true
    }

    // MARK: - Helpers

    /// Gets the TTY for a process ID using `ps`.
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

    /// Returns the title of the frontmost window.
    private func frontmostWindowTitle() -> String {
        guard let frontApp = NSWorkspace.shared.frontmostApplication else { return "" }
        if frontApp.bundleIdentifier == Bundle.main.bundleIdentifier { return "Sessions" }

        let axApp = AXUIElementCreateApplication(frontApp.processIdentifier)
        var windowRef: CFTypeRef?
        guard AXUIElementCopyAttributeValue(axApp, kAXFocusedWindowAttribute as CFString, &windowRef) == .success,
              let window = windowRef else { return "" }

        var titleRef: CFTypeRef?
        AXUIElementCopyAttributeValue(window as! AXUIElement, kAXTitleAttribute as CFString, &titleRef)
        return (titleRef as? String) ?? ""
    }

    /// Runs an AppleScript and returns the result string, or nil on failure.
    private func runAppleScript(_ source: String) -> String? {
        var error: NSDictionary?
        guard let script = NSAppleScript(source: source) else { return nil }
        let result = script.executeAndReturnError(&error)
        if error != nil { return nil }
        return result.stringValue
    }
}
