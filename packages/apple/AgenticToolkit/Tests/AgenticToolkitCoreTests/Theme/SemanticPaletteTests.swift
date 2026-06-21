import Testing
import Foundation
@testable import AgenticToolkitCore

@Suite("SemanticPalette")
struct SemanticPaletteTests {

    private let theme = BuiltInThemes.dracula
    private var palette: SemanticPalette { SemanticPalette(theme: theme) }

    @Test("derives core roles directly from the palette")
    func directDerivations() {
        #expect(palette.windowBackground == theme.background)
        #expect(palette.primaryText == theme.foreground)
        #expect(palette.selection == theme.selection)
        #expect(palette.cursor == theme.cursor)
    }

    @Test("maps ANSI slots onto semantic accent roles")
    func ansiMapping() {
        #expect(palette.danger == theme.ansi[1])
        #expect(palette.success == theme.ansi[2])
        #expect(palette.warning == theme.ansi[3])
        #expect(palette.accent == theme.ansi[4])
        #expect(palette.info == theme.ansi[6])
    }

    @Test("derives distinct secondary and tertiary text tones")
    func derivedTextTones() {
        #expect(palette.secondaryText != palette.primaryText)
        #expect(palette.tertiaryText != palette.secondaryText)
    }

    @Test("explicit role overrides win over derived colors")
    func overridePrecedence() {
        let custom = RGBAColor(red: 0.5, green: 0.1, blue: 0.9, alpha: 1)
        var overridden = theme
        overridden.roleOverrides = [ThemeRole.accent.rawValue: custom]
        let palette = SemanticPalette(theme: overridden)

        #expect(palette.color(.accent) == custom)
        #expect(palette.derived(.accent) == theme.ansi[4])  // derivation ignores overrides
    }
}
