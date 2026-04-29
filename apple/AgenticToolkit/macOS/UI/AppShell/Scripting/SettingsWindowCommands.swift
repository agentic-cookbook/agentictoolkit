import AppKit

/// AppleScript command: `show settings` — shows whichever
/// `SingleWindowController` is registered under the `"settings"`
/// `windowID`. Decoupled from any specific settings coordinator: the
/// controller is looked up via `WindowManager.shared.registry`, which
/// every `SingleWindowController` populates at init.
@objc(ShowSettingsCommand)
public final class ShowSettingsCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        WindowManager.shared.registry.controller(forID: "settings")?.showWindow()
        return nil
    }
}

/// AppleScript command: `hide settings` — counterpart to
/// `ShowSettingsCommand`.
@objc(HideSettingsCommand)
public final class HideSettingsCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        WindowManager.shared.registry.controller(forID: "settings")?.dismiss()
        return nil
    }
}
