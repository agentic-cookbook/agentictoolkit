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

    @Test("attribution and isImported round-trip through Codable")
    func metadataRoundTrip() throws {
        var theme = BuiltInThemes.nord
        theme.isImported = true
        theme.attribution = "Arctic Ice Studio"

        let data = try JSONEncoder().encode(theme)
        let decoded = try JSONDecoder().decode(ColorTheme.self, from: data)

        #expect(decoded == theme)
        #expect(decoded.isImported)
        #expect(decoded.attribution == "Arctic Ice Studio")
    }

    @Test("themes persisted before isImported/attribution existed still decode")
    func decodesLegacyWithoutNewFields() throws {
        let ansi = Array(repeating: "\"#000000ff\"", count: 16).joined(separator: ",")
        let legacy = "{\"id\":\"x\",\"name\":\"Legacy\",\"appearance\":\"dark\",\"isBuiltIn\":false,"
            + "\"foreground\":\"#ffffffff\",\"background\":\"#000000ff\",\"cursor\":\"#ffffffff\","
            + "\"selection\":\"#000000ff\",\"ansi\":[\(ansi)]}"
        let decoded = try JSONDecoder().decode(ColorTheme.self, from: Data(legacy.utf8))
        #expect(decoded.isImported == false)
        #expect(decoded.attribution == nil)
    }

    @Test("editability: built-in and imported are locked, custom is editable")
    func editability() {
        #expect(BuiltInThemes.dracula.isLocked)
        #expect(!BuiltInThemes.dracula.isEditable)
        #expect(!BuiltInThemes.dracula.isDeletable)

        var imported = BuiltInThemes.dracula
        imported.isBuiltIn = false
        imported.isImported = true
        #expect(imported.isLocked)
        #expect(!imported.isEditable)
        #expect(imported.isDeletable)

        var custom = BuiltInThemes.dracula
        custom.isBuiltIn = false
        custom.isImported = false
        #expect(custom.isEditable)
        #expect(!custom.isLocked)
        #expect(custom.isDeletable)
    }

    @Test("every built-in theme carries an attribution")
    func builtInsHaveAttribution() {
        for theme in BuiltInThemes.all {
            #expect(theme.attribution?.isEmpty == false, "\(theme.name) missing attribution")
        }
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

    @Test("RGBAColor clamps out-of-range and non-finite components to [0, 1]")
    func rgbaClampsComponents() {
        let over = RGBAColor(red: 1.5, green: -0.2, blue: 2.0, alpha: 9)
        #expect(over.red == 1)
        #expect(over.green == 0)
        #expect(over.blue == 1)
        #expect(over.alpha == 1)

        let nonFinite = RGBAColor(red: .nan, green: 0.5, blue: .infinity, alpha: -.infinity)
        #expect(nonFinite.red == 0)       // NaN → 0
        #expect(nonFinite.green == 0.5)
        #expect(nonFinite.blue == 1)      // +∞ → 1
        #expect(nonFinite.alpha == 0)     // -∞ → 0
    }
}
