import Testing
import Foundation
@testable import AgenticToolkitCore

@Suite("ThemeTypography")
struct ThemeTypographyTests {

    @Test("system typography provides a style for every text role")
    func systemHasAllRoles() {
        let typo = ThemeTypography.system
        for role in TextRole.allCases {
            let style = typo.style(role)
            #expect(style.size > 0)
        }
        // Code is monospaced; body is not.
        #expect(typo.style(.code).monospaced == true)
        #expect(typo.style(.body).monospaced == false)
        // Title is larger than body.
        #expect(typo.style(.title).size > typo.style(.body).size)
    }

    @Test("sizeScale multiplies the effective size of every role")
    func sizeScaleApplies() {
        var typo = ThemeTypography.system
        let baseBody = typo.style(.body).size
        typo.sizeScale = 1.5
        #expect(typo.size(.body) == baseBody * 1.5)
        // The stored style size is unchanged; only the effective size scales.
        #expect(typo.style(.body).size == baseBody)
    }

    @Test("an explicit per-role style overrides the default")
    func explicitStyleWins() {
        var typo = ThemeTypography.system
        typo.styles[TextRole.body.rawValue] = FontStyle(family: "Menlo", size: 17, weight: .bold, monospaced: true)
        #expect(typo.style(.body).family == "Menlo")
        #expect(typo.style(.body).size == 17)
        #expect(typo.style(.body).weight == .bold)
        // Untouched roles still resolve to their defaults.
        #expect(typo.style(.title).size == ThemeTypography.defaultStyle(.title).size)
    }

    @Test("round-trips through Codable")
    func codableRoundTrip() throws {
        var typo = ThemeTypography(sizeScale: 1.25)
        typo.styles[TextRole.title.rawValue] = FontStyle(family: "Avenir Next", size: 24, weight: .heavy)
        let data = try JSONEncoder().encode(typo)
        let decoded = try JSONDecoder().decode(ThemeTypography.self, from: data)
        #expect(decoded == typo)
        #expect(decoded.size(.title) == 24 * 1.25)
    }

    @Test("ColorTheme defaults to system typography and round-trips with custom typography")
    func colorThemeCarriesTypography() throws {
        let plain = ColorTheme(
            name: "X", appearance: .dark,
            foreground: RGBAColor(hexString: "#ffffffff")!,
            background: RGBAColor(hexString: "#000000ff")!,
            cursor: RGBAColor(hexString: "#ffffffff")!,
            selection: RGBAColor(hexString: "#333333ff")!,
            ansi: Array(repeating: RGBAColor(hexString: "#808080ff")!, count: 16)
        )
        #expect(plain.typography == .system)

        var custom = plain
        custom.typography.sizeScale = 1.4
        let data = try JSONEncoder().encode(custom)
        let decoded = try JSONDecoder().decode(ColorTheme.self, from: data)
        #expect(decoded.typography.sizeScale == 1.4)
    }
}
