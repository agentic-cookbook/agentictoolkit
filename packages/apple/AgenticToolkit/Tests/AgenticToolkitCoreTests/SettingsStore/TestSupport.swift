import Foundation
@testable import AgenticToolkitCore

// MARK: - Sample Codable types used in tests

struct UserPreferences: Codable, Equatable {
    var displayName: String
    var theme: Theme
    var notificationsEnabled: Bool

    enum Theme: String, Codable {
        case light, dark, system
    }
}

// MARK: - Test keys
//
// Test keys are declared on `UserSettings` exactly like production keys, so
// `UserSettings.hasCompletedOnboarding.value` works through the
// `StorableSetting.value` accessor and `store.get(UserSettings.X)` works at
// the storage-provider call sites.

@MainActor
extension UserSettings {
    static var hasCompletedOnboarding = UserSetting<Bool>("test.hasCompletedOnboarding", default: false)
    static var launchCount            = UserSetting<Int>("test.launchCount", default: 0)
    static var displayName            = UserSetting<String>("test.displayName", default: "Anonymous")
    static var volume                 = UserSetting<Double>("test.volume", default: 0.5)
    static var recentSearches         = UserSetting<[String]>("test.recentSearches", default: [])
    static var favoriteNumbers        = UserSetting<[Int]>("test.favoriteNumbers", default: [])
    static var userPreferences        = UserSetting<UserPreferences>(
        "test.userPreferences",
        default: .init(displayName: "Default", theme: .system, notificationsEnabled: true)
    )
    static var lastOpened             = UserSetting<Date>("test.lastOpened", default: .distantPast)
}
