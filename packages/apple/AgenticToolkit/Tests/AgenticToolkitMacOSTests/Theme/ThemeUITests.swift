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

    @Test("ThemeDetailPanelViewController builds a flipped, scrollable preview tab")
    func detailPanelScroll() {
        let store = ThemeStore()
        guard let theme = store.allThemes.first else { Issue.record("no themes"); return }
        let panel = ThemeDetailPanelViewController(
            theme: theme, store: store, onRowInvalidated: {})
        panel.loadViewIfNeeded()

        // The detail is a tab view now — Preview and Edit — so the scrolling
        // one is the Preview tab's own view, not the panel's root.
        let tabs = panel.view.subviews.compactMap { $0 as? NSTabView }.first
        let preview = tabs?.tabViewItems.first { $0.label == "Preview" }
        let scroll = preview?.view as? NSScrollView
        #expect(scroll != nil)
        // Content must pin to the TOP — the document view has to be flipped.
        #expect(scroll?.documentView?.isFlipped == true)
    }

    @Test("ThemeSettingsPanelViewController builds one panel per theme")
    func panel() {
        let panel = ThemeSettingsPanelViewController()
        #expect(panel.descriptor.title == "Theme")
        // Loading the view runs viewDidLoad, which populates one detail panel per
        // theme in the nested split.
        panel.loadViewIfNeeded()
        #expect(!panel.panels.isEmpty)
        #expect(panel.panels.count == ThemeStore().allThemes.count)
    }
}
