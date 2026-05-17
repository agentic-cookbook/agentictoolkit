import AppKit

@MainActor
private var coordinator: TerminalCoordinator? {
    NSApp.scriptingHost?.feature(TerminalCoordinator.self)
}

/// AppleScript command: `new terminal` — opens a new terminal window.
@objc(NewTerminalCommand)
public final class NewTerminalCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        coordinator?.openNewTerminalWindow()
        return nil
    }
}

@objc(NewTerminalSessionCommand)
public final class NewTerminalSessionCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        coordinator?.openNewTerminalSession()
        return nil
    }
}

@objc(ToggleTerminalSidebarCommand)
public final class ToggleTerminalSidebarCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        coordinator?.toggleSidebar()
        return nil
    }
}
