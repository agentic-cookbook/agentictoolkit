import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS


import AppKit
import ApplicationServices
import UserNotifications
import os

extension SessionWatcher {
    
    /// The System Settings pane to open when guiding the user to fix a permission.
    public enum SessionWatcherPermissionPane: String, Sendable {
        case accessibility
        case automation = "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
        case notifications = "x-apple.systempreferences:com.apple.preference.security?Privacy_Notifications"
        
        public var displayName: String {
            switch self {
            case .accessibility: return "Accessibility"
            case .automation: return "Automation"
            case .notifications: return "Notifications"
            }
        }
        
        public func open() {
            switch self {
            case .accessibility:
                logger.info("Opening Accessibility settings via AXIsProcessTrustedWithOptions")
                let options = ["AXTrustedCheckOptionPrompt": true] as CFDictionary
                let trusted = AXIsProcessTrustedWithOptions(options)
                logger.info("AXIsProcessTrustedWithOptions returned: \(trusted)")
            default:
                logger.info("Opening System Settings URL: \(rawValue, privacy: .public)")
                if let url = URL(string: rawValue) {
                    NSWorkspace.shared.open(url)
                }
            }
        }
    }
    
    /// Errors that can occur when executing a session click action.
    public enum SessionWatcherActionError: Error, LocalizedError {
        case directoryNotFound(String)
        case transcriptNotFound(String)
        case commandFailed(String)
        case notificationFailed(String)
        case noActionConfigured
        case permissionDenied(String, pane: SessionWatcherPermissionPane)
        
        public var errorDescription: String? {
            switch self {
            case .directoryNotFound(let path):
                return "Directory not found: \(path)"
            case .transcriptNotFound(let path):
                return "Transcript file not found: \(path)"
            case .commandFailed(let message):
                return "Command failed: \(message)"
            case .notificationFailed(let message):
                return "Notification failed: \(message)"
            case .noActionConfigured:
                return "No click action configured"
            case .permissionDenied(let message, _):
                return message
            }
        }
        
        /// If this is a permission error, returns the pane the user should open.
        public var permissionPane: SessionWatcherPermissionPane? {
            if case .permissionDenied(_, let pane) = self { return pane }
            return nil
        }
    }
    
    /// Result of executing a session click action.
    public enum SessionWatcherActionResult {
        case success
        case failure(SessionWatcherActionError)
    }
    
    /// Handles execution of session click actions.
    public final class SessionWatcherActionHandler: @unchecked Sendable {
        
        // MARK: - Settings Keys
        
        public static let clickActionKey = "click_action"
        public static let customCommandKey = "custom_command_template"
        
        // MARK: - Accessibility
        
        /// Checks whether accessibility access has been granted. Does NOT prompt.
        public static var isAccessibilityTrusted: Bool {
            AXIsProcessTrusted()
        }
        
        // MARK: - Properties
        
        private let settingsStore: SettingsStore
        
        // MARK: - Initialization
        
        public init(settingsStore: SettingsStore) {
            self.settingsStore = settingsStore
        }
        
        // MARK: - Configuration
        
        public var currentAction: SessionWatcherClickAction {
            // SettingsStore is @MainActor; callers (UI clicks) run on the main actor.
            let raw: String = MainActor.assumeIsolated {
                settingsStore.get(UserSettings.clickAction)
            }
            return SessionWatcherClickAction(rawValue: raw) ?? .activateWindow
        }
        
        public func setAction(_ action: SessionWatcherClickAction) {
            let rawValue = action.rawValue
            MainActor.assumeIsolated {
                settingsStore.set(rawValue, for: UserSettings.clickAction)
            }
        }
        
        public var customCommandTemplate: String {
            let value: String = MainActor.assumeIsolated {
                settingsStore.get(UserSettings.customCommandTemplate)
            }
            return value.isEmpty ? "echo $SESSION_ID $CWD $MODEL" : value
        }
        
        public func setCustomCommandTemplate(_ template: String) {
            MainActor.assumeIsolated {
                settingsStore.set(template, for: UserSettings.customCommandTemplate)
            }
        }
        
        // MARK: - Execution
        
        @discardableResult
        public func execute(for session: SessionWatcherSession) -> SessionWatcherActionResult {
            let action = currentAction
            logger.info("SessionWatcherSession clicked: \(session.sessionId, privacy: .public) project=\(session.projectName, privacy: .public) cwd=\(session.cwd, privacy: .public) action=\(action.rawValue, privacy: .public)")
            return execute(action: action, for: session)
        }
        
        @discardableResult
        public func execute(action: SessionWatcherClickAction, for session: SessionWatcherSession) -> SessionWatcherActionResult {
            logger.info("Executing action '\(action.rawValue, privacy: .public)' for session \(session.sessionId, privacy: .public)")
            let result: SessionWatcherActionResult
            switch action {
            case .openTerminal:
                result = openTerminal(at: session.cwd)
            case .activateWarp:
                result = activateWarpSession(for: session)
            case .activateWindow:
                result = activateMatchingWindow(for: session)
            case .openTranscript:
                result = openTranscript(for: session)
            case .copySessionId:
                result = copySessionId(session.sessionId)
            case .customCommand:
                result = runCustomCommand(for: session)
            case .sendNotification:
                result = sendNotification(for: session)
            }
            
            switch result {
            case .success:
                logger.info("Action '\(action.rawValue, privacy: .public)' succeeded")
            case .failure(let error):
                logger.error("Action '\(action.rawValue, privacy: .public)' failed: \(error.localizedDescription, privacy: .public)")
            }
            return result
        }
        
        // MARK: - Open Terminal
        
        private func openTerminal(at path: String) -> SessionWatcherActionResult {
            logger.debug("openTerminal: path='\(path, privacy: .public)'")
            guard !path.isEmpty else {
                logger.warning("openTerminal: empty path")
                return .failure(.directoryNotFound(""))
            }
            
            let expandedPath = (path as NSString).expandingTildeInPath
            logger.debug("openTerminal: expandedPath='\(expandedPath, privacy: .public)'")
            guard FileManager.default.fileExists(atPath: expandedPath) else {
                logger.warning("openTerminal: directory does not exist")
                return .failure(.directoryNotFound(expandedPath))
            }
            
            if NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.googlecode.iterm2") != nil {
                logger.debug("openTerminal: using iTerm2")
                let script = """
                tell application "iTerm"
                    activate
                    create window with default profile command "cd \(shellEscape(expandedPath)) && exec $SHELL -l"
                end tell
            """
                var error: NSDictionary?
                if let appleScript = NSAppleScript(source: script) {
                    appleScript.executeAndReturnError(&error)
                    if let error = error {
                        logger.warning("openTerminal: iTerm2 error: \(String(describing: error), privacy: .public)")
                        if let permError = appleScriptPermissionError(error, appName: "iTerm2") {
                            return .failure(permError)
                        }
                        return openTerminalApp(at: expandedPath)
                    }
                    return .success
                }
                return openTerminalApp(at: expandedPath)
            } else {
                logger.debug("openTerminal: using Terminal.app")
                return openTerminalApp(at: expandedPath)
            }
        }
        
        private func openTerminalApp(at path: String) -> SessionWatcherActionResult {
            let script = """
            tell application "Terminal"
                activate
                do script "cd \(shellEscape(path))"
            end tell
        """
            var error: NSDictionary?
            if let appleScript = NSAppleScript(source: script) {
                appleScript.executeAndReturnError(&error)
                if let error = error {
                    if let permError = appleScriptPermissionError(error, appName: "Terminal") {
                        return .failure(permError)
                    }
                    return .failure(.commandFailed("Terminal.app script error: \(error)"))
                }
                return .success
            }
            return .failure(.commandFailed("Failed to create AppleScript for Terminal.app"))
        }
        
        // MARK: - Activate Warp SessionWatcherSession
        
        private func activateWarpSession(for session: SessionWatcherSession) -> SessionWatcherActionResult {
            logger.info("activateWarp: cwd='\(session.cwd, privacy: .public)' project='\(session.projectName, privacy: .public)'")
            
            guard !session.cwd.isEmpty else {
                logger.warning("activateWarp: empty cwd")
                return .failure(.directoryNotFound(""))
            }
            
            // Check Warp is running
            let warpApps = NSRunningApplication.runningApplications(withBundleIdentifier: "dev.warp.Warp-Stable")
            logger.info("activateWarp: found \(warpApps.count) running Warp instance(s)")
            guard let warpApp = warpApps.first else {
                logger.warning("activateWarp: Warp is not running")
                return .failure(.commandFailed("Warp is not running"))
            }
            
            let warpPID = warpApp.processIdentifier
            logger.debug("activateWarp: Warp PID=\(warpPID)")
            
            let expandedCwd = (session.cwd as NSString).expandingTildeInPath
            let projectName = session.projectName
            logger.debug("activateWarp: looking for window matching project='\(projectName, privacy: .public)' or cwd='\(expandedCwd, privacy: .public)'")
            
            // Strategy 1: Use CGWindowList to find Warp windows and match by title
            guard let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
                logger.error("activateWarp: CGWindowListCopyWindowInfo returned nil")
                return .failure(.commandFailed("Unable to read window list"))
            }
            
            var warpWindows: [(name: String, number: Int, layer: Int)] = []
            for entry in windowList {
                guard let ownerPID = entry[kCGWindowOwnerPID as String] as? pid_t,
                      ownerPID == warpPID else { continue }
                
                let name = entry[kCGWindowName as String] as? String ?? "<no title>"
                let number = entry[kCGWindowNumber as String] as? Int ?? -1
                let layer = entry[kCGWindowLayer as String] as? Int ?? -1
                warpWindows.append((name: name, number: number, layer: layer))
                logger.debug("activateWarp: Warp window #\(number) layer=\(layer) title='\(name, privacy: .public)'")
            }
            
            logger.info("activateWarp: found \(warpWindows.count) Warp window(s) on screen")
            
            if warpWindows.isEmpty {
                // Warp is running but no on-screen windows — just activate it
                logger.info("activateWarp: no on-screen windows, just activating Warp")
                warpApp.activate()
                return .success
            }
            
            // Try to find a matching window by title
            // Warp window titles typically show: "projectName — command" or the cwd path
            let matchCandidates = [projectName, expandedCwd, (expandedCwd as NSString).lastPathComponent]
            logger.debug("activateWarp: match candidates: \(matchCandidates, privacy: .public)")
            
            var bestMatch: (name: String, number: Int)? = nil
            for candidate in matchCandidates {
                guard !candidate.isEmpty else { continue }
                for w in warpWindows where w.layer == 0 { // layer 0 = normal windows
                    if w.name.localizedCaseInsensitiveContains(candidate) {
                        logger.info("activateWarp: matched window #\(w.number) title='\(w.name, privacy: .public)' via candidate='\(candidate, privacy: .public)'")
                        bestMatch = (name: w.name, number: w.number)
                        break
                    }
                }
                if bestMatch != nil { break }
            }
            
            // Check accessibility permission upfront — don't re-prompt if already denied
            guard Self.isAccessibilityTrusted else {
                logger.error("activateWarp: Accessibility permission not granted")
                return .failure(.permissionDenied(
                    "Whippet needs Accessibility access to raise Warp windows. Grant access in System Settings.",
                    pane: .accessibility
                ))
            }
            
            // Strategy 2: Use Accessibility API to find and raise the matching window
            logger.debug("activateWarp: querying Accessibility API for Warp windows")
            let axApp = AXUIElementCreateApplication(warpPID)
            var axWindowsRef: CFTypeRef?
            let axResult = AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &axWindowsRef)
            
            if axResult != .success {
                logger.warning("activateWarp: AXUIElementCopyAttributeValue failed with \(axResult.rawValue)")
            }
            
            let axWindows = (axWindowsRef as? [AXUIElement]) ?? []
            logger.debug("activateWarp: Accessibility found \(axWindows.count) window(s)")
            
            for (i, window) in axWindows.enumerated() {
                var titleRef: CFTypeRef?
                AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef)
                let axTitle = titleRef as? String ?? "<no title>"
                logger.debug("activateWarp: AX window[\(i)] title='\(axTitle, privacy: .public)'")
            }
            
            // Activate Warp first
            logger.debug("activateWarp: activating Warp app")
            warpApp.activate()
            
            if let match = bestMatch {
                // Raise the specific window via Accessibility
                logger.info("activateWarp: raising matched window '\(match.name, privacy: .public)'")
                for window in axWindows {
                    var titleRef: CFTypeRef?
                    AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef)
                    if let title = titleRef as? String, title == match.name {
                        let raiseResult = AXUIElementPerformAction(window, kAXRaiseAction as CFString)
                        logger.debug("activateWarp: AXRaise result=\(raiseResult.rawValue)")
                        return .success
                    }
                }
                // Couldn't raise via AX but we matched — Warp is activated at least
                logger.info("activateWarp: could not raise via AX, but Warp is now frontmost")
                return .success
            }
            
            // No title match — fall back to raising the first normal-layer window
            if let firstNormal = warpWindows.first(where: { $0.layer == 0 }) {
                logger.info("activateWarp: no title match, raising first window '\(firstNormal.name, privacy: .public)'")
                for window in axWindows {
                    var titleRef: CFTypeRef?
                    AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef)
                    if let title = titleRef as? String, title == firstNormal.name {
                        AXUIElementPerformAction(window, kAXRaiseAction as CFString)
                        return .success
                    }
                }
            }
            
            logger.info("activateWarp: no match found, Warp activated without specific window")
            return .success
        }
        
        // MARK: - Activate Matching Window (any app)
        
        private func activateMatchingWindow(for session: SessionWatcherSession) -> SessionWatcherActionResult {
            let projectName = session.projectName
            let branch = session.gitBranch
            let log = ActivationTestLog.whippetShared
            log.append("activateMatchingWindow: project=\"\(projectName)\" branch=\"\(branch)\" cwd=\"\(session.cwd)\"")
            
            guard projectName != "Unknown" else {
                return .failure(.commandFailed("No project name to match — session has no working directory"))
            }
            
            guard Self.isAccessibilityTrusted else {
                return .failure(.permissionDenied(
                    "Whippet needs Accessibility access to discover windows. Grant access in System Settings.",
                    pane: .accessibility
                ))
            }
            
            // Strategy 1: For iTerm2 sessions, try TTY-based tab activation first.
            // iTerm2 window titles show Claude's session names, not project names,
            // so AX title matching won't work. TTY matching is precise.
            if session.termProgram == "iTerm.app" && session.pid > 0 {
                if let tty = ttyForPid(session.pid) {
                    log.append("  iTerm TTY strategy: pid=\(session.pid) tty=\(tty)")
                    if activateITermByTTY(tty: tty) {
                        log.append("  iTerm TTY activation succeeded")
                        return .success
                    }
                    log.append("  iTerm TTY activation failed, falling through to AX scan")
                }
            }
            
            // Strategy 2: Collect all candidate windows across all apps, scored by match quality
            struct Candidate {
                let app: NSRunningApplication
                let axApp: AXUIElement
                let axWindow: AXUIElement
                let title: String
                let score: Int
            }
            
            var candidates: [Candidate] = []
            
            let ownBundleId = Bundle.main.bundleIdentifier ?? ""
            for app in NSWorkspace.shared.runningApplications {
                guard app.activationPolicy == .regular else { continue }
                // Never match our own windows (e.g. Window Discovery panel)
                if app.bundleIdentifier == ownBundleId { continue }
                let pid = app.processIdentifier
                let axApp = AXUIElementCreateApplication(pid)
                var windowsRef: CFTypeRef?
                guard AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &windowsRef) == .success,
                      let axWindows = windowsRef as? [AXUIElement] else { continue }
                
                for axWindow in axWindows {
                    var titleRef: CFTypeRef?
                    AXUIElementCopyAttributeValue(axWindow, kAXTitleAttribute as CFString, &titleRef)
                    guard let title = titleRef as? String, !title.isEmpty else { continue }
                    
                    // Match on project name OR cwd path components
                    let cwdLastComponent = (session.cwd as NSString).lastPathComponent
                    let matchesProject = title.localizedCaseInsensitiveContains(projectName)
                    let matchesCwd = !session.cwd.isEmpty && title.localizedCaseInsensitiveContains(cwdLastComponent)
                    let matchesCwdFull = !session.cwd.isEmpty && title.localizedCaseInsensitiveContains(session.cwd)
                    guard matchesProject || matchesCwd || matchesCwdFull else { continue }
                    
                    // Score: higher is better
                    var score = matchesProject ? 1 : 0
                    if matchesCwdFull { score += 3 }
                    if matchesCwd { score += 1 }
                    
                    // +2 if title ends with "*" (Warp marks active/modified tabs)
                    if title.hasSuffix("*") {
                        score += 2
                    }
                    
                    // +10 if branch also matches in the title
                    if !branch.isEmpty && title.localizedCaseInsensitiveContains(branch) {
                        score += 10
                    }
                    
                    // +5 if the full cwd last two components match (e.g., "projects/Whippet")
                    let cwdComponents = session.cwd.split(separator: "/").suffix(2)
                    if cwdComponents.count == 2 {
                        let twoLevel = cwdComponents.joined(separator: "/")
                        if title.localizedCaseInsensitiveContains(twoLevel) {
                            score += 5
                        }
                    }
                    
                    // +20 if this app matches the session's terminal program
                    let bundleId = app.bundleIdentifier ?? ""
                    if !session.termProgram.isEmpty {
                        if (session.termProgram == "WarpTerminal" && bundleId.contains("warp"))
                            || (session.termProgram == "Apple_Terminal" && bundleId.contains("Terminal"))
                            || (session.termProgram == "iTerm.app" && bundleId.contains("iterm"))
                            || (session.termProgram == "vscode" && bundleId.contains("VSCode")) {
                            score += 20
                        }
                    } else {
                        // No termProgram recorded — prefer known terminal apps
                        if bundleId.contains("warp") || bundleId.contains("Terminal")
                            || bundleId.contains("iterm") || bundleId.contains("VSCode") {
                            score += 10
                        }
                    }
                    
                    candidates.append(Candidate(app: app, axApp: axApp, axWindow: axWindow, title: title, score: score))
                }
            }
            
            // Sort by score descending (stable sort preserves window order for ties)
            let sorted = candidates.sorted { $0.score > $1.score }
            
            log.append("  Candidates: \(sorted.count)")
            for (i, c) in sorted.enumerated() {
                log.append("    [\(i)] score=\(c.score) \"\(c.title)\"")
            }
            
            guard !sorted.isEmpty else {
                log.append("  No match found")
                return .failure(.commandFailed("No window found matching \"\(projectName)\""))
            }
            
            // If the frontmost window already matches this project, cycle to the next one.
            // This handles multiple sessions in the same project (e.g., two Whippet tabs).
            let best: Candidate
            if let frontApp = NSWorkspace.shared.frontmostApplication,
               let firstCandidate = sorted.first,
               firstCandidate.app.processIdentifier == frontApp.processIdentifier {
                // Get the current main window's AX element for identity comparison
                let axFrontApp = AXUIElementCreateApplication(frontApp.processIdentifier)
                var mainRef: CFTypeRef?
                AXUIElementCopyAttributeValue(axFrontApp, kAXMainWindowAttribute as CFString, &mainRef)
                var currentTitle = ""
                if let main = mainRef {
                    var titleRef: CFTypeRef?
                    AXUIElementCopyAttributeValue(main as! AXUIElement, kAXTitleAttribute as CFString, &titleRef)
                    currentTitle = (titleRef as? String) ?? ""
                }
                
                if currentTitle.localizedCaseInsensitiveContains(projectName),
                   sorted.count > 1,
                   let currentMain = mainRef {
                    // Current window already matches — cycle to the next AX element.
                    // Compare by AX element identity (CFEqual), not title, since
                    // multiple tabs can have identical titles.
                    if let next = sorted.first(where: { !CFEqual($0.axWindow, currentMain as! AXUIElement) }) {
                        best = next
                        log.append("  Cycling: current=\"\(currentTitle)\" → next=\"\(best.title)\"")
                    } else {
                        best = sorted[0]
                        log.append("  Only one AX element, using first")
                    }
                } else {
                    best = sorted[0]
                }
            } else {
                best = sorted[0]
            }
            
            log.append("  Selected: score=\(best.score) \"\(best.title)\"")
            
            // Activate: app → pause → raise+setMain+setFocused → pause → raise
            best.app.activate()
            Thread.sleep(forTimeInterval: 0.15)
            
            AXUIElementPerformAction(best.axWindow, kAXRaiseAction as CFString)
            AXUIElementSetAttributeValue(best.axWindow, kAXMainAttribute as CFString, true as CFTypeRef)
            AXUIElementSetAttributeValue(best.axApp, kAXFocusedWindowAttribute as CFString, best.axWindow)
            
            Thread.sleep(forTimeInterval: 0.15)
            AXUIElementPerformAction(best.axWindow, kAXRaiseAction as CFString)
            
            return .success
        }
        
        private func raiseWindow(pid: pid_t, windowName: String) {
            guard Self.isAccessibilityTrusted else {
                logger.debug("raiseWindow: accessibility not trusted, skipping")
                return
            }
            
            let appElement = AXUIElementCreateApplication(pid)
            var windowsRef: CFTypeRef?
            let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
            guard result == .success, let windows = windowsRef as? [AXUIElement] else {
                logger.debug("raiseWindow: AX query failed (\(result.rawValue)) for PID \(pid)")
                return
            }
            
            for window in windows {
                var titleRef: CFTypeRef?
                if AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef) == .success,
                   let title = titleRef as? String,
                   title == windowName {
                    let raiseResult = AXUIElementPerformAction(window, kAXRaiseAction as CFString)
                    logger.debug("raiseWindow: raised '\(windowName, privacy: .public)' result=\(raiseResult.rawValue)")
                    return
                }
            }
            logger.debug("raiseWindow: no AX window matched '\(windowName, privacy: .public)'")
        }
        
        // MARK: - Open Transcript
        
        private func openTranscript(for session: SessionWatcherSession) -> SessionWatcherActionResult {
            logger.debug("openTranscript: sessionId=\(session.sessionId, privacy: .public)")
            let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
            let possiblePaths = [
                "\(homeDir)/.claude/projects/\(session.sessionId)/transcript.md",
                "\(homeDir)/.claude/projects/\(session.sessionId)/transcript.json",
                "\(homeDir)/.claude/sessions/\(session.sessionId)/transcript.md",
                "\(homeDir)/.claude/sessions/\(session.sessionId)/transcript.json",
            ]
            
            for path in possiblePaths {
                if FileManager.default.fileExists(atPath: path) {
                    logger.info("openTranscript: found at \(path, privacy: .public)")
                    NSWorkspace.shared.open(URL(fileURLWithPath: path))
                    return .success
                }
            }
            
            logger.info("openTranscript: not found in any location")
            return .failure(.transcriptNotFound(
                "No transcript found for session \(session.sessionId). Looked in ~/.claude/projects/ and ~/.claude/sessions/."
            ))
        }
        
        // MARK: - Copy SessionWatcherSession ID
        
        private func copySessionId(_ sessionId: String) -> SessionWatcherActionResult {
            logger.debug("copySessionId: \(sessionId, privacy: .public)")
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(sessionId, forType: .string)
            return .success
        }
        
        // MARK: - Custom Command
        
        private func runCustomCommand(for session: SessionWatcherSession) -> SessionWatcherActionResult {
            let template = customCommandTemplate
            let command = substituteVariables(in: template, session: session)
            logger.info("runCustomCommand: template='\(template, privacy: .public)' expanded='\(command, privacy: .public)'")
            
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/bin/sh")
            process.arguments = ["-c", command]
            
            let pipe = Pipe()
            process.standardOutput = pipe
            process.standardError = pipe
            
            do {
                try process.run()
                DispatchQueue.global(qos: .userInitiated).async {
                    process.waitUntilExit()
                    if process.terminationStatus != 0 {
                        let data = pipe.fileHandleForReading.readDataToEndOfFile()
                        let output = String(data: data, encoding: .utf8) ?? "Unknown error"
                        Self.logger.error("Custom command failed (exit \(process.terminationStatus)): \(output, privacy: .public)")
                    } else {
                        Self.logger.debug("Custom command completed successfully")
                    }
                }
                return .success
            } catch {
                logger.error("Custom command launch failed: \(error.localizedDescription, privacy: .public)")
                return .failure(.commandFailed(error.localizedDescription))
            }
        }
        
        // MARK: - Send Notification
        
        private func sendNotification(for session: SessionWatcherSession) -> SessionWatcherActionResult {
            logger.debug("sendNotification: \(session.projectName, privacy: .public)")
            let content = UNMutableNotificationContent()
            content.title = "Whippet: \(session.projectName)"
            content.body = "SessionWatcherSession: \(session.sessionId)\nModel: \(session.model)\nStatus: \(session.status.rawValue)"
            content.sound = .default
            
            let request = UNNotificationRequest(
                identifier: "whippet-click-\(session.sessionId)-\(Date().timeIntervalSince1970)",
                content: content,
                trigger: nil
            )
            
            UNUserNotificationCenter.current().add(request) { error in
                if let error = error {
                    Self.logger.error("Notification delivery failed: \(error.localizedDescription, privacy: .public)")
                }
            }
            
            return .success
        }
        
        // MARK: - iTerm2 TTY Activation
        
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
            var error: NSDictionary?
            guard let appleScript = NSAppleScript(source: script) else { return false }
            let result = appleScript.executeAndReturnError(&error)
            if error != nil { return false }
            return result.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) == "found"
        }
        
        // MARK: - Helpers
        
        public func substituteVariables(in template: String, session: SessionWatcherSession) -> String {
            var result = template
            result = result.replacingOccurrences(of: "$SESSION_ID", with: posixShellEscape(session.sessionId))
            result = result.replacingOccurrences(of: "$CWD", with: posixShellEscape(session.cwd))
            result = result.replacingOccurrences(of: "$MODEL", with: posixShellEscape(session.model))
            return result
        }
        
        private func posixShellEscape(_ string: String) -> String {
            return "'" + string.replacingOccurrences(of: "'", with: "'\\''") + "'"
        }
        
        private func shellEscape(_ string: String) -> String {
            var escaped = string
            escaped = escaped.replacingOccurrences(of: "\\", with: "\\\\")
            escaped = escaped.replacingOccurrences(of: "\"", with: "\\\"")
            escaped = escaped.filter { !$0.isNewline && $0 != "\r" && $0 != "\0" }
            return escaped
        }
        
        /// Checks an AppleScript error dictionary for authorization/permission failures.
        /// Returns a `.permissionDenied` error if detected, nil otherwise.
        private func appleScriptPermissionError(_ error: NSDictionary, appName: String) -> SessionWatcherActionError? {
            let errorNumber = error[NSAppleScript.errorNumber] as? Int
            let errorMessage = error[NSAppleScript.errorMessage] as? String ?? ""
            
            // -1743 = "Not authorized to send Apple events"
            // -1744 = "A privilege violation occurred"
            if errorNumber == -1743 || errorNumber == -1744
                || errorMessage.localizedCaseInsensitiveContains("not authorized")
                || errorMessage.localizedCaseInsensitiveContains("privilege violation") {
                logger.error("AppleScript permission denied for \(appName, privacy: .public): \(errorMessage, privacy: .public)")
                return .permissionDenied(
                    "Whippet needs permission to control \(appName). Grant access in System Settings > Privacy & Security > Automation.",
                    pane: .automation
                )
            }
            return nil
        }
    }
}
extension SessionWatcher.SessionWatcherActionHandler: Loggable {
    public static nonisolated let logger = makeLogger()
}

extension SessionWatcher.SessionWatcherPermissionPane: Loggable {
    public static nonisolated let logger = makeLogger()
}

