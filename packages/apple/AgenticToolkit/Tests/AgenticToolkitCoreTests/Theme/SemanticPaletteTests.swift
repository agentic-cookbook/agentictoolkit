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

    @Test("chartSeriesColors are non-empty and all contrast against the surface")
    func chartSeriesVisible() {
        let series = palette.chartSeriesColors
        #expect(series.count >= 5)
        let surface = palette.color(.surface)
        for color in series {
            #expect(color.contrastRatio(against: surface) >= 1.5)
        }
    }

    @Test("chartSeriesColors never collapse onto the window background")
    func chartSeriesAvoidBackground() {
        // Regression: charts used to cycle ansiColors from index 0; the terminal
        // "black" slot equals the background on many themes, so the first series
        // was invisible. chartSeriesColors must exclude any near-background color.
        var ansi = Array(repeating: RGBAColor(hexString: "#268bd2ff")!, count: 16)
        ansi[0] = RGBAColor(hexString: "#1e1e2eff")!   // ANSI black == background
        let degenerate = ColorTheme(
            name: "T", appearance: .dark,
            foreground: RGBAColor(hexString: "#cdd6f4ff")!,
            background: RGBAColor(hexString: "#1e1e2eff")!,
            cursor: .white, selection: RGBAColor(hexString: "#445566ff")!, ansi: ansi
        )
        let palette = SemanticPalette(theme: degenerate)
        #expect(!palette.chartSeriesColors.contains(palette.color(.windowBackground)))
    }

    @Test("identitySeriesColors tell members apart without claiming a state")
    func identitySeriesAvoidsSpokenRoles() {
        let identity = palette.identitySeriesColors
        #expect(identity.count >= 2)  // enough to tell a nested gauge's rings apart
        let surface = palette.color(.surface)
        for color in identity {
            #expect(color.contrastRatio(against: surface) >= 1.5)
            // The whole point: a ring that means "the second one" must not be
            // wearing the color the same view uses to mean "in trouble".
            #expect(color != palette.color(.accent))
            #expect(color != palette.color(.success))
            #expect(color != palette.color(.warning))
            #expect(color != palette.color(.danger))
        }
        #expect(Set(identity.map(\.hexString)).count == identity.count)
    }

    @Test("identitySeriesColors fall back rather than come back empty")
    func identitySeriesNeverEmpty() {
        // A theme whose magenta and cyan slots are all the surface itself: two
        // members in one color still beat two members in no color at all.
        let surface = RGBAColor(hexString: "#1e1e2eff")!
        var ansi = Array(repeating: RGBAColor(hexString: "#268bd2ff")!, count: 16)
        for slot in [5, 6, 13, 14] { ansi[slot] = surface }
        let flattened = ColorTheme(
            name: "T", appearance: .dark,
            foreground: RGBAColor(hexString: "#cdd6f4ff")!,
            background: surface,
            cursor: .white, selection: RGBAColor(hexString: "#445566ff")!, ansi: ansi
        )
        let palette = SemanticPalette(theme: flattened)
        #expect(palette.identitySeriesColors == palette.chartSeriesColors)
    }
}
