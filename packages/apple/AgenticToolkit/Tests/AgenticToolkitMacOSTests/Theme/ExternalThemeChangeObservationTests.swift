import Testing
import Foundation
import AppKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS
@testable import AgenticDeveloperToolkitUI

/// Regression coverage for the bug Task 6a shipped: moving `ThemeManager` into
/// `AgenticDeveloperToolkitUI` dropped the two `UserSettingObserver`s the old
/// AgenticToolkit-hosted `ThemeManager` used to react to a theme changed from
/// *outside* `selectTheme(id:)`. Two live call sites do exactly that —
/// `ComposableSettings.ThemeChoiceViewModel` (bound straight to
/// `UserSettings.activeThemeID`) and `ThemeDetailPanelViewController`'s
/// `ThemeManager.shared == nil` fallback — so a theme picked in the Composable
/// Settings window persisted but nothing repainted until relaunch.
///
/// `ThemeStorage.onExternalChange` (declared in ADT, implemented here by
/// `UserSettingsThemeStorage` with the same `UserSettingObserver`s the old
/// class used) closes that gap. These tests exercise it end to end, against a
/// REAL `UserSettings` backed by an isolated `UserDefaults(suiteName:)` —
/// never `.standard` — following `LegacyThemePersistenceTests`. A double
/// exercising only `InMemoryThemeStorage` (see
/// `AgenticDeveloperToolkitUITests`) cannot catch this: its `onExternalChange`
/// is never invoked by anything, so it can't prove the wiring that makes
/// `ThemeChoiceViewModel` and the panel's fallback branch actually repaint.
@MainActor
@Suite(.serialized)
struct ExternalThemeChangeObservationTests {

    private let suiteName = "AgenticToolkitExternalThemeChangeObservationTests"

    /// Points `UserSettings.shared` at a fresh, isolated `UserDefaults` domain
    /// AND re-creates the `activeThemeID` / `customThemes` statics bound to
    /// it. The re-creation matters: `UserSetting.init` captures whichever
    /// `UserSettings.shared` is live at the moment the static is first
    /// touched — anywhere in the test process — and keeps observing that one
    /// store's change publisher even after a later test reassigns
    /// `UserSettings.shared`. Without rebinding the statics here too, this
    /// suite's writes could silently target a *different* test's store than
    /// the one `UserSettingObserver` is listening to, so the redraw would
    /// never fire and the test would look like the pre-fix bug even after
    /// the fix.
    /// Returns the isolated store and the closure that puts the process back
    /// the way it was found. **Both halves matter.** All three things reassigned
    /// here are process-wide `static var`s, so a suite that only wipes its own
    /// defaults domain still leaves every later test in the bundle pointed at a
    /// `UserSettings` whose backing domain has just been deleted — a failure
    /// that lands somewhere else and looks like anything but this file.
    private func freshDefaults() -> (defaults: UserDefaults, restore: () -> Void) {
        let previousShared = UserSettings.shared
        let previousActiveThemeID = UserSettings.activeThemeID
        let previousCustomThemes = UserSettings.customThemes

        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        UserSettings.shared = UserSettings(with: UserDefaultsSettingsStorageProvider(defaults: defaults))
        UserSettings.activeThemeID = UserSetting<String>("theme.active_theme_id", default: BuiltInThemes.defaultID)
        UserSettings.customThemes = UserSetting<[ColorTheme]>("theme.custom_themes", default: [])

        let suiteName = self.suiteName
        return (defaults, {
            UserSettings.customThemes = previousCustomThemes
            UserSettings.activeThemeID = previousActiveThemeID
            UserSettings.shared = previousShared
            defaults.removePersistentDomain(forName: suiteName)
        })
    }

    /// Waits for the observer's delivery, which lands on the next turn of the
    /// **main queue** (see `UserSetting.swift`).
    ///
    /// It has to suspend, and a nested `RunLoop.run(until:)` will not do. This
    /// test body is itself a block executing on the main queue, and a serial
    /// queue does not re-enter: spinning a nested runloop from inside it drains
    /// runloop sources but never the queue, so the observer's block cannot run
    /// until this function *returns*. Awaiting does hand control back, and the
    /// queue is FIFO — the hop below was enqueued after the observer's, so by
    /// the time it resumes, the observer has already fired.
    private func drain() async {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { continuation.resume() }
        }
    }

    // MARK: - 1. UserSettings.activeThemeID written directly (the
    // ThemeChoiceViewModel path)

    @Test("writing UserSettings.activeThemeID.value directly posts didChangeNotification and updates currentPalette")
    func directActiveThemeWritePropagates() async {
        let (_, restore) = freshDefaults()
        defer { restore() }

        let manager = ThemeManager()
        #expect(manager.currentTheme.id == BuiltInThemes.defaultID)

        final class Flag: @unchecked Sendable { var fired = false }
        let flag = Flag()
        let token = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification, object: manager, queue: nil
        ) { _ in flag.fired = true }
        defer { NotificationCenter.default.removeObserver(token) }

        // Exactly what ThemeChoiceViewModel's ChoiceViewModel<String> does:
        // write the setting directly, never touching ThemeManager.
        UserSettings.activeThemeID.value = BuiltInThemes.dracula.id
        await drain()

        #expect(flag.fired)
        #expect(manager.currentTheme.id == BuiltInThemes.dracula.id)
        #expect(manager.currentPalette.windowBackground == BuiltInThemes.dracula.background)
    }

    // MARK: - 2. UserSettings.customThemes written directly (an in-place edit
    // of the active custom theme, e.g. from a sync or another panel)

    @Test("writing UserSettings.customThemes directly posts didChangeNotification when it redefines the active theme")
    func directCustomThemesWritePropagates() async {
        let (_, restore) = freshDefaults()
        defer { restore() }

        let original = ThemeStore().duplicate(BuiltInThemes.nord, nameSuffix: " Custom")
        UserSettings.activeThemeID.value = original.id

        let manager = ThemeManager()
        #expect(manager.currentTheme.id == original.id)
        #expect(manager.currentTheme.name == original.name)

        final class Flag: @unchecked Sendable { var fired = false }
        let flag = Flag()
        let token = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification, object: manager, queue: nil
        ) { _ in flag.fired = true }
        defer { NotificationCenter.default.removeObserver(token) }

        // Edit the active custom theme's definition in place and write it back
        // through UserSettings.customThemes directly — never touching
        // ThemeManager or ThemeStore.
        var edited = original
        edited.name = "Nord Custom (edited)"
        UserSettings.customThemes.value = [edited]
        await drain()

        #expect(flag.fired)
        #expect(manager.currentTheme.name == "Nord Custom (edited)")
    }

    // MARK: - 3. selectTheme(id:) must not double-post

    @Test("selectTheme(id:) posts didChangeNotification exactly once, not twice")
    func selectThemePostsExactlyOnce() async {
        let (_, restore) = freshDefaults()
        defer { restore() }

        let manager = ThemeManager()

        final class Counter: @unchecked Sendable { var count = 0 }
        let counter = Counter()
        let token = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification, object: manager, queue: nil
        ) { _ in counter.count += 1 }
        defer { NotificationCenter.default.removeObserver(token) }

        // selectTheme(id:) writes storage.activeThemeID (which will also fire
        // the newly-restored UserSettingObserver, asynchronously) AND calls
        // reload() synchronously itself. Without the re-entrancy guard in
        // reload(), that's two posts for one selection.
        manager.selectTheme(id: BuiltInThemes.dracula.id)
        await drain()

        #expect(counter.count == 1)
        #expect(manager.currentTheme.id == BuiltInThemes.dracula.id)
    }
}
