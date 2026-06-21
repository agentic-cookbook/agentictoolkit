import Testing
import Foundation
@testable import AgenticToolkitCore

@Suite("BuiltInThemes")
struct BuiltInThemesTests {

    @Test("ships exactly eight themes")
    func count() {
        #expect(BuiltInThemes.all.count == 8)
    }

    @Test("all themes have unique IDs")
    func uniqueIDs() {
        let ids = Set(BuiltInThemes.all.map(\.id))
        #expect(ids.count == BuiltInThemes.all.count)
    }

    @Test("every theme has a valid 16-color palette and is marked built-in")
    func validity() {
        for theme in BuiltInThemes.all {
            #expect(theme.hasValidPalette, "\(theme.name) should have 16 ANSI colors")
            #expect(theme.isBuiltIn, "\(theme.name) should be built-in")
        }
    }

    @Test("defaultID resolves to Solarized Dark")
    func defaultResolves() {
        let theme = BuiltInThemes.theme(withID: BuiltInThemes.defaultID)
        #expect(theme?.name == "Solarized Dark")
    }

    @Test("hex literals parse to the expected colors")
    func hexAccuracy() {
        // Guards the rgb() helper and the porting accuracy.
        #expect(BuiltInThemes.dracula.background == RGBAColor(hexString: "#282A36FF"))
        #expect(BuiltInThemes.dracula.foreground == RGBAColor(hexString: "#F8F8F2FF"))
        #expect(BuiltInThemes.dracula.ansi[5] == RGBAColor(hexString: "#FF79C6FF"))
        #expect(BuiltInThemes.solarizedLight.background == RGBAColor(hexString: "#FDF6E3FF"))
    }
}
