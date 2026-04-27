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

extension StoredSetting.Key where Value == Bool {
    static var hasCompletedOnboarding: any StorableSetting<Value> {
        .init("test.hasCompletedOnboarding", default: false)
    }
}

extension StoredSetting.Key where Value == Int {
    static var launchCount: StoredSetting<Int>.Key {
        .init("test.launchCount", default: 0)
    }
}

extension StoredSetting.Key where Value == String {
    static var displayName: StoredSettingKey<String> {
        .init("test.displayName", default: "Anonymous")
    }
}

extension StoredSetting.Key where Value == Double {
    static var volume: StoredSetting<Double>.Key {
        .init("test.volume", default: 0.5)
    }
}

extension StoredSetting.Key where Value == [String] {
    static var recentSearches: StoredSetting<[String]>.Key {
        .init("test.recentSearches", default: [])
    }
}

extension StoredSetting.Key where Value == [Int] {
    static var favoriteNumbers: StoredSetting<[Int]>.Key {
        .init("test.favoriteNumbers", default: [])
    }
}

extension StoredSetting.Key where Value == UserPreferences {
    static var userPreferences: StoredSetting<UserPreferences>.Key {
        .init("test.userPreferences", default: .init(
            displayName: "Default",
            theme: .system,
            notificationsEnabled: true
        ))
    }
}

extension StoredSetting.Key where Value == Date {
    static var lastOpened: StoredSetting<Date>.Key {
        .init("test.lastOpened", default: .distantPast)
    }
}
