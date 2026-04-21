import AppKit
import ApplicationServices
import AgenticToolkitScripting

// MARK: - Strategy A: iTerm2 TTY Matching

/// Activates the iTerm2 tab whose session is on the target's TTY.
/// Applies when the target's `termProgram` is `iTerm.app` or unspecified.
public struct ITermTTYStrategy: WindowActivationStrategy {

    public let name = "iTerm TTY"

    public init() {}

    public func appliesTo(_ target: WindowActivationTarget) -> Bool {
        target.termProgram == "iTerm.app" || target.termProgram.isEmpty
    }

    public func activate(_ target: WindowActivationTarget, log: ActivationTestLog) -> Bool {
        guard let tty = TTYResolver.tty(forPID: target.pid) else {
            log.append("  iTerm TTY: pid \(target.pid) has no TTY")
            return false
        }
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

        switch AppleScriptRunner.run(script) {
        case .success(let value):
            let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed == "found" { return true }
            log.append("  iTerm TTY: \(devTTY) not found in any iTerm session")
            return false
        case .compileFailed:
            log.append("  iTerm TTY: AppleScript failed to compile")
            return false
        case .runtimeFailed(let message, let number):
            log.append("  iTerm TTY: AppleScript failed: \(message) (error \(number))")
            return false
        }
    }
}

// MARK: - Strategy B: AX Title Match

/// Walks every running app's accessibility windows and activates the first one
/// whose title contains the target's project name or working directory.
/// Applies whenever the target has a project name other than "Unknown".
public struct AXTitleMatchStrategy: WindowActivationStrategy {

    public let name = "AX title match"

    private let runningApps: RunningAppsProvider

    public init(runningApps: RunningAppsProvider = RealRunningAppsProvider()) {
        self.runningApps = runningApps
    }

    public func appliesTo(_ target: WindowActivationTarget) -> Bool {
        target.projectName != "Unknown"
    }

    public func activate(_ target: WindowActivationTarget, log: ActivationTestLog) -> Bool {
        let projectName = target.projectName
        let cwdLast = (target.cwd as NSString).lastPathComponent

        for app in runningApps.runningApplications {
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
}

// MARK: - Strategy C: Bring Terminal App to Front

/// Brings the matching terminal app to the front without selecting a specific window.
/// Last-resort strategy.
public struct BringTerminalToFrontStrategy: WindowActivationStrategy {

    public let name = "bring terminal to front"

    /// Catalog used to match `termProgram` → bundle ID. Defaults to
    /// `KnownTerminals.all`; pass a custom catalog to support additional
    /// terminals without patching the toolkit.
    private let catalog: [KnownTerminal]
    private let runningApps: RunningAppsProvider

    public init(
        catalog: [KnownTerminal] = KnownTerminals.all,
        runningApps: RunningAppsProvider = RealRunningAppsProvider()
    ) {
        self.catalog = catalog
        self.runningApps = runningApps
    }

    public func appliesTo(_ target: WindowActivationTarget) -> Bool {
        KnownTerminals.match(termProgram: target.termProgram, in: catalog) != nil
    }

    public func activate(_ target: WindowActivationTarget, log: ActivationTestLog) -> Bool {
        guard let term = KnownTerminals.match(termProgram: target.termProgram, in: catalog),
              let app = runningApps.runningApplications(withBundleIdentifier: term.bundleID).first else {
            return false
        }
        app.activate()
        return true
    }
}
