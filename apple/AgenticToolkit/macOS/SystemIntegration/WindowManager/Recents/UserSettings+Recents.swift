import Foundation
import AgenticToolkitCore

extension UserSettings {

    /// Maximum number of recent documents shown in File → Open Recent.
    /// Mirrored to `NSDocumentController.maximumRecentDocumentCount` by
    /// `WindowManager.applyRecentDocumentCountFromSettings()`.
    public static let recentWindowsCount = UserSetting<Int>("recentWindowsCount", default: 10)

    /// Whether windows reopen at launch.
    public static let reopenOnLaunchPolicy = UserSetting<ReopenOnLaunchPolicy>(
        "reopenOnLaunchPolicy",
        default: .useSystem
    )
}
