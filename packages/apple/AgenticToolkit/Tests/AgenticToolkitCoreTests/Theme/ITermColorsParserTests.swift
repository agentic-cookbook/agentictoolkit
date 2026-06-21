import Testing
import Foundation
@testable import AgenticToolkitCore

@Suite("ITermColorsParser")
struct ITermColorsParserTests {

    // MARK: Fixtures

    private static func componentDict(
        _ red: Double, _ green: Double, _ blue: Double, alpha: Double = 1
    ) -> [String: Any] {
        ["Red Component": red, "Green Component": green, "Blue Component": blue,
         "Alpha Component": alpha, "Color Space": "sRGB"]
    }

    /// Builds `.itermcolors` plist data. ANSI colors default to opaque black.
    private static func makeData(
        foreground: (Double, Double, Double),
        background: (Double, Double, Double),
        includeCursor: Bool = true,
        includeSelection: Bool = true,
        dropForeground: Bool = false,
        ansi: [(Double, Double, Double)] = Array(repeating: (0, 0, 0), count: 16)
    ) throws -> Data {
        var dict: [String: Any] = [:]
        if !dropForeground { dict["Foreground Color"] = componentDict(foreground.0, foreground.1, foreground.2) }
        dict["Background Color"] = componentDict(background.0, background.1, background.2)
        if includeCursor { dict["Cursor Color"] = componentDict(0.9, 0.9, 0.9) }
        if includeSelection { dict["Selection Color"] = componentDict(0.2, 0.2, 0.2) }
        for index in 0..<16 {
            dict["Ansi \(index) Color"] = componentDict(ansi[index].0, ansi[index].1, ansi[index].2)
        }
        return try PropertyListSerialization.data(fromPropertyList: dict, format: .xml, options: 0)
    }

    // MARK: Happy path

    @Test("parses foreground, background and all 16 ANSI colors")
    func parsesPalette() throws {
        var ansi = Array(repeating: (0.0, 0.0, 0.0), count: 16)
        ansi[5] = (1.0, 0.0, 0.5)
        let data = try Self.makeData(foreground: (1, 1, 1), background: (0, 0, 0), ansi: ansi)

        let theme = try ITermColorsParser.parse(data: data, name: "Test")

        #expect(theme.name == "Test")
        #expect(theme.foreground == RGBAColor(red: 1, green: 1, blue: 1, alpha: 1))
        #expect(theme.background == RGBAColor(red: 0, green: 0, blue: 0, alpha: 1))
        #expect(theme.ansi.count == 16)
        #expect(theme.ansi[5] == RGBAColor(red: 1, green: 0, blue: 0.5, alpha: 1))
        #expect(!theme.isBuiltIn)
    }

    @Test("infers dark appearance from a dark background")
    func infersDark() throws {
        let data = try Self.makeData(foreground: (1, 1, 1), background: (0, 0, 0))
        let theme = try ITermColorsParser.parse(data: data, name: "Dark")
        #expect(theme.appearance == .dark)
    }

    @Test("infers light appearance from a light background")
    func infersLight() throws {
        let data = try Self.makeData(foreground: (0, 0, 0), background: (1, 1, 1))
        let theme = try ITermColorsParser.parse(data: data, name: "Light")
        #expect(theme.appearance == .light)
    }

    @Test("explicit appearance overrides inference")
    func explicitAppearance() throws {
        let data = try Self.makeData(foreground: (1, 1, 1), background: (0, 0, 0))
        let theme = try ITermColorsParser.parse(data: data, name: "Forced", appearance: .light)
        #expect(theme.appearance == .light)
    }

    @Test("falls back when cursor and selection are absent")
    func fallbacks() throws {
        let data = try Self.makeData(
            foreground: (1, 1, 1), background: (0, 0, 0),
            includeCursor: false, includeSelection: false
        )
        let theme = try ITermColorsParser.parse(data: data, name: "Partial")
        #expect(theme.cursor == theme.foreground)
        #expect(theme.selection == theme.background.blended(withFraction: 0.25, of: theme.foreground))
    }

    // MARK: Errors (fail-fast)

    @Test("throws when the plist is not a dictionary")
    func notADictionary() throws {
        let data = try PropertyListSerialization.data(fromPropertyList: [1, 2, 3], format: .xml, options: 0)
        #expect(throws: ITermColorsParseError.notADictionary) {
            try ITermColorsParser.parse(data: data, name: "Bad")
        }
    }

    @Test("throws when a required color is missing")
    func missingColor() throws {
        let data = try Self.makeData(foreground: (1, 1, 1), background: (0, 0, 0), dropForeground: true)
        #expect(throws: ITermColorsParseError.missingColor("Foreground Color")) {
            try ITermColorsParser.parse(data: data, name: "Bad")
        }
    }

    @Test("throws when a color component is missing")
    func missingComponent() throws {
        var dict: [String: Any] = [:]
        dict["Foreground Color"] = ["Green Component": 1.0, "Blue Component": 1.0]  // no Red Component
        dict["Background Color"] = Self.componentDict(0, 0, 0)
        for index in 0..<16 { dict["Ansi \(index) Color"] = Self.componentDict(0, 0, 0) }
        let data = try PropertyListSerialization.data(fromPropertyList: dict, format: .xml, options: 0)

        let expected = ITermColorsParseError.missingComponent(
            colorKey: "Foreground Color", component: "Red Component"
        )
        #expect(throws: expected) {
            try ITermColorsParser.parse(data: data, name: "Bad")
        }
    }
}
