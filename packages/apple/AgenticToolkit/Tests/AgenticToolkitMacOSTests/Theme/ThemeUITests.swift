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

    @Test("ThemeProfilesSettingsView lists all themes")
    func settingsViewLists() {
        let view = ThemeProfilesSettingsView(frame: .zero)
        #expect(view.subviews.contains { $0 is NSSplitView })
        #expect(view.numberOfRows(in: NSTableView()) == BuiltInThemes.all.count)
    }

    @Test("ThemeSettingsPanelViewController wires up its view")
    func panel() {
        let panel = ThemeSettingsPanelViewController()
        #expect(panel.descriptor.title == "Theme")
        #expect(panel.view.subviews.contains { $0 is ThemeProfilesSettingsView })
    }
}
