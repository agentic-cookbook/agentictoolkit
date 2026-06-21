import Testing
import Foundation
@testable import AgenticToolkitCore

@Suite("ColorTheme")
struct ColorThemeTests {

    @Test("round-trips through Codable")
    func codableRoundTrip() throws {
        // Colors persist as 8-bit #RRGGBBAA, so use a grid-exact override value.
        var theme = BuiltInThemes.dracula
        theme.roleOverrides = [ThemeRole.accent.rawValue: RGBAColor(hexString: "#11223344")!]

        let data = try JSONEncoder().encode(theme)
        let decoded = try JSONDecoder().decode(ColorTheme.self, from: data)

        #expect(decoded == theme)
    }

    @Test("ansiColor(at:) returns the color in range and nil out of range")
    func ansiIndexing() {
        let theme = BuiltInThemes.nord
        #expect(theme.ansiColor(at: 0) == theme.ansi[0])
        #expect(theme.ansiColor(at: 15) == theme.ansi[15])
        #expect(theme.ansiColor(at: 16) == nil)
        #expect(theme.ansiColor(at: -1) == nil)
    }

    @Test("hasValidPalette requires exactly 16 ANSI colors")
    func paletteValidity() {
        #expect(BuiltInThemes.dracula.hasValidPalette)

        let short = ColorTheme(
            name: "Short", appearance: .dark,
            foreground: .white, background: .black, cursor: .white, selection: .black,
            ansi: [.black, .white, .black]
        )
        #expect(!short.hasValidPalette)
    }
}
