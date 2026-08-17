import Foundation
import Testing
@testable import AgenticToolkitPermissions

@Suite("Permission metadata")
struct PermissionMetadataTests {
    private static let allKinds: [Permission] = [
        .accessibility,
        .notifications,
        .automation(targetBundleID: "com.googlecode.iterm2"),
        .location
    ]

    @Test("display names")
    func displayNames() {
        #expect(Permission.accessibility.displayName == "Accessibility")
        #expect(Permission.notifications.displayName == "Notifications")
        #expect(Permission.automation(targetBundleID: "com.googlecode.iterm2").displayName == "Automation")
        // Exact string match matters here beyond cosmetics: MacPermissionGateTests'
        // ScriptedChecker (in the OlyloCore superproject) keys its answers by
        // this displayName, so a drift here would silently answer .undetermined
        // for every location query there.
        #expect(Permission.location.displayName == "Location")
    }

    @Test("every permission has a non-empty SF Symbol and explanation")
    func symbolsAndExplanations() {
        for permission in Self.allKinds {
            #expect(!permission.systemImageName.isEmpty)
            #expect(!permission.explanation.isEmpty)
        }
    }

    @Test("settings pane URLs point at the right panes")
    func settingsPaneURLs() {
        #expect(
            Permission.accessibility.settingsPaneURL.absoluteString
                == "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        )
        #expect(
            Permission.automation(targetBundleID: "com.googlecode.iterm2").settingsPaneURL.absoluteString
                == "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
        )
        #expect(
            Permission.notifications.settingsPaneURL.absoluteString
                .hasPrefix("x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=")
        )
        #expect(
            Permission.location.settingsPaneURL.absoluteString
                == "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices"
        )
    }
}
