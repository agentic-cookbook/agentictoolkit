import Testing
import Foundation
import AppKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@MainActor
@Suite(.serialized)
struct ThemeManagerTests {

    init() {
        UserSettings.shared = UserSettings(with: InMemorySettingsStorageProvider())
    }

    @Test("resolves the default active theme at init")
    func defaultActive() {
        let manager = ThemeManager()
        #expect(manager.currentTheme.id == BuiltInThemes.defaultID)
        #expect(manager.currentPalette.theme == manager.currentTheme)
    }

    @Test("selecting a theme updates the current theme and palette")
    func selectsTheme() {
        let manager = ThemeManager()
        manager.selectTheme(id: BuiltInThemes.dracula.id)
        #expect(manager.currentTheme == BuiltInThemes.dracula)
        #expect(manager.currentPalette.windowBackground == BuiltInThemes.dracula.background)
    }

    @Test("falls back to Solarized Dark for an unknown theme ID")
    func unknownFallback() {
        let manager = ThemeManager()
        manager.selectTheme(id: "does-not-exist")
        #expect(manager.currentTheme == BuiltInThemes.solarizedDark)
    }

    @Test("can select a freshly added custom theme")
    func selectsCustom() {
        let manager = ThemeManager()
        let custom = manager.store.duplicate(BuiltInThemes.nord, nameSuffix: " Custom")
        manager.selectTheme(id: custom.id)
        #expect(manager.currentTheme.id == custom.id)
        #expect(manager.currentTheme.name == "Nord Custom")
    }

    @Test("drives NSApplication appearance from the theme's light/dark/auto")
    func drivesAppearance() {
        // Must reference NSApplication.shared (not the NSApp implicitly-unwrapped
        // global, which is nil until the host first touches NSApplication.shared)
        // so a host that builds the manager before app setup does not crash.
        let manager = ThemeManager()
        manager.selectTheme(id: BuiltInThemes.solarizedDark.id)
        #expect(NSApplication.shared.appearance?.name == .darkAqua)
        manager.selectTheme(id: BuiltInThemes.githubLight.id)
        #expect(NSApplication.shared.appearance?.name == .aqua)
    }

    @Test("posts didChange when the theme changes")
    func postsNotification() {
        final class Flag: @unchecked Sendable { var fired = false }
        let flag = Flag()
        let manager = ThemeManager()
        let token = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification, object: manager, queue: nil
        ) { _ in flag.fired = true }
        defer { NotificationCenter.default.removeObserver(token) }

        manager.selectTheme(id: BuiltInThemes.dracula.id)
        #expect(flag.fired)
    }

    @Test("re-selecting the active theme posts nothing (no redundant reload)")
    func reselectingActiveThemePostsNothing() {
        final class Counter: @unchecked Sendable { var count = 0 }
        let counter = Counter()
        let manager = ThemeManager()
        manager.selectTheme(id: BuiltInThemes.dracula.id)
        // Drain any pending async observer fire from the first selection.
        RunLoop.current.run(until: Date().addingTimeInterval(0.1))

        let token = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification, object: manager, queue: nil
        ) { _ in counter.count += 1 }
        defer { NotificationCenter.default.removeObserver(token) }

        manager.selectTheme(id: BuiltInThemes.dracula.id)   // already active → guard bails
        RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        #expect(counter.count == 0)
    }

    @Test("excludes the shared system pickers from window-background theming")
    func windowBackgroundFilter() {
        let normal = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 100, height: 100),
            styleMask: [.titled], backing: .buffered, defer: true
        )
        #expect(ThemeManager.shouldThemeBackground(of: normal))
        #expect(!ThemeManager.shouldThemeBackground(of: NSColorPanel.shared))
        #expect(!ThemeManager.shouldThemeBackground(of: NSFontPanel.shared))
    }
}
