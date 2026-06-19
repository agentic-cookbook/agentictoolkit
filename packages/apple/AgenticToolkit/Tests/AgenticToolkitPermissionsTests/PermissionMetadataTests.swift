import Foundation
import Testing
@testable import AgenticToolkitPermissions

@Suite("Permission metadata")
struct PermissionMetadataTests {
    private static let allKinds: [Permission] = [
        .accessibility,
        .notifications,
        .automation(targetBundleID: "com.googlecode.iterm2")
    ]

    @Test("display names")
    func displayNames() {
        #expect(Permission.accessibility.displayName == "Accessibility")
        #expect(Permission.notifications.displayName == "Notifications")
        #expect(Permission.automation(targetBundleID: "com.googlecode.iterm2").displayName == "Automation")
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
    }
}
