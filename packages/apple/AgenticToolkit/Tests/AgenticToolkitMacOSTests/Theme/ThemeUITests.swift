import Testing
import AppKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@MainActor
@Suite(.serialized)
struct ThemeUITests {

    init() {
        UserSettings.shared = UserSettings(with: InMemorySettingsStorageProvider())
    }

    @Test("SwatchGridView builds and accepts colors")
    func swatchGrid() {
        let palette = SemanticPalette(theme: BuiltInThemes.dracula)
        let grid = ComposableSettings.SwatchGridView(colors: palette.ansiColors)
        grid.setColors(SemanticPalette(theme: BuiltInThemes.nord).ansiColors)
        #expect(!grid.subviews.isEmpty)
    }

    @Test("ThemePreviewView renders a theme")
    func preview() {
        let preview = ComposableSettings.ThemePreviewView(theme: BuiltInThemes.gruvboxDark)
        preview.show(BuiltInThemes.solarizedLight)
        #expect(!preview.subviews.isEmpty)
    }

    @Test("ThemePickerView builds")
    func picker() {
        let picker = ComposableSettings.ThemePickerView()
        #expect(!picker.subviews.isEmpty)
    }

    @Test("ThemeProfilesSettingsView builds a flipped, scrollable gallery")
    func settingsViewGallery() {
        let view = ThemeProfilesSettingsView(frame: NSRect(x: 0, y: 0, width: 760, height: 640))
        view.layoutSubtreeIfNeeded()
        let scroll = view.subviews.compactMap { $0 as? NSScrollView }.first
        #expect(scroll != nil)
        // Content must pin to the TOP — the document view has to be flipped.
        #expect(scroll?.documentView?.isFlipped == true)
    }

    @Test("ThemeSettingsPanelViewController wires up its view")
    func panel() {
        let panel = ThemeSettingsPanelViewController()
        #expect(panel.descriptor.title == "Theme")
        #expect(panel.view.subviews.contains { $0 is ThemeProfilesSettingsView })
    }
}
