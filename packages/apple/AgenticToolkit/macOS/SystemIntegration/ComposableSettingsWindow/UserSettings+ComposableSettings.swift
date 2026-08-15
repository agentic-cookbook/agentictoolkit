import Foundation
import AgenticToolkitCore

extension UserSettings {

    /// Whether the settings window discloses its help drawer.
    ///
    /// One setting for the whole window, not one per panel: the drawer is a
    /// reading mode the user is either in or out of, and a per-panel memory would
    /// make it flap open and shut as they moved down the list.
    ///
    /// Defaults to `true` so a first launch explains what each panel is for
    /// without the user having to discover the button. Once closed it stays
    /// closed, which is the whole reason the preference is persisted.
    public static let settingsHelpDrawerVisible = UserSetting<Bool>(
        "settingsHelpDrawerVisible",
        default: true
    )
}
