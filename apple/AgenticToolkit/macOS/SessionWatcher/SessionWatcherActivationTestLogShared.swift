import AgenticToolkitCoreUI
import Foundation

public extension ActivationTestLog {
    /// Process-wide log instance used by the session list for click diagnostics
    /// and the menu item's full test harness run. Both write to
    /// `~/Library/Application Support/Whippet/activation-test.log`.
    public static let whippetShared = ActivationTestLog(appSupportSubdirectory: "Whippet")
}
