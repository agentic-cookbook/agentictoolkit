import Testing
import Foundation
import AppKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

/// Task 6 Step 2 added `activeThemeID` to `ThemeStorage` / `UserSettingsThemeStorage`,
/// backed by the SAME on-disk key (`theme.active_theme_id`) `ThemeManager` read and
/// wrote before the seam existed. That equivalence is the load-bearing guarantee of
/// the whole migration: someone who picked a non-default theme on a previous build
/// must not have it silently reset back to Solarized Dark the next time they launch.
///
/// An in-memory `ThemeStorage` double (see `AgenticDeveloperToolkitUITests`'s
/// `ThemeManagerTests`) proves the seam compiles and wires up — it proves nothing
/// about persistence, because nothing about it ever touches a disk. This suite
/// manufactures the legacy on-disk state in a REAL `UserDefaults` domain — isolated
/// to its own suite name, never `.standard` — writing the raw key exactly as an
/// older build would have, entirely outside today's code path, then confirms the
/// previously-selected theme survives being read back through the new seam.
@MainActor
@Suite(.serialized)
struct LegacyThemePersistenceTests {

    private let suiteName = "AgenticToolkitLegacyThemePersistenceTests"
    private let key = "theme.active_theme_id"

    private func freshDefaults() -> UserDefaults {
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        return defaults
    }

    @Test("a theme selected under an older build is still selected when read back through UserSettingsThemeStorage")
    func survivesThroughStorageAdapter() {
        let defaults = freshDefaults()
        defer { defaults.removePersistentDomain(forName: suiteName) }

        // Manufacture legacy on-disk state exactly as a pre-seam build would have
        // left it: a raw String under the literal key, written directly to
        // UserDefaults — not routed through UserSettingsThemeStorage, ThemeStore,
        // or ThemeManager.
        defaults.set(BuiltInThemes.dracula.id, forKey: key)

        UserSettings.shared = UserSettings(with: UserDefaultsSettingsStorageProvider(defaults: defaults))
        let storage = UserSettingsThemeStorage()
        #expect(storage.activeThemeID == BuiltInThemes.dracula.id)
    }

    @Test("a theme selected under an older build is still selected when ThemeManager() launches")
    func survivesThroughThemeManagerLaunch() {
        let defaults = freshDefaults()
        defer { defaults.removePersistentDomain(forName: suiteName) }

        defaults.set(BuiltInThemes.gruvboxDark.id, forKey: key)

        UserSettings.shared = UserSettings(with: UserDefaultsSettingsStorageProvider(defaults: defaults))
        // The real end-to-end path a relaunching app takes: ThemeManager()'s
        // zero-argument convenience init, reading through UserSettingsThemeStorage,
        // reading through UserDefaults — no test doubles anywhere in the chain.
        let manager = ThemeManager()
        #expect(manager.currentTheme.id == BuiltInThemes.gruvboxDark.id)
    }

    @Test("writing through the new seam still lands under the historical key, unchanged")
    func writesUnderTheHistoricalKey() {
        let defaults = freshDefaults()
        defer { defaults.removePersistentDomain(forName: suiteName) }

        UserSettings.shared = UserSettings(with: UserDefaultsSettingsStorageProvider(defaults: defaults))
        let storage = UserSettingsThemeStorage()
        storage.activeThemeID = BuiltInThemes.nord.id

        // Read back with the raw UserDefaults API, bypassing UserSettings entirely,
        // to confirm the key string itself — not just some accessor's round trip.
        #expect(defaults.string(forKey: key) == BuiltInThemes.nord.id)
    }
}
