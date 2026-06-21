import Testing
import Foundation
@testable import AgenticToolkitCore

@Suite("BuiltInThemes")
struct BuiltInThemesTests {

    @Test("ships the full curated theme set")
    func count() {
        #expect(BuiltInThemes.all.count == 15)
    }

    @Test("every theme defines authentic app-chrome role overrides")
    func chromeOverrides() {
        for theme in BuiltInThemes.all {
            for role in [ThemeRole.surface, .elevatedSurface, .controlBackground, .border, .outline] {
                #expect(theme.roleOverrides[role.rawValue] != nil, "\(theme.name) missing \(role.rawValue)")
            }
        }
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

    @Test("every built-in theme is legible and shows distinct panels")
    func legibility() {
        for theme in BuiltInThemes.all {
            let palette = SemanticPalette(theme: theme)
            let background = palette.color(.windowBackground)
            #expect(palette.color(.primaryText).contrastRatio(against: background) >= 4.0,
                    "\(theme.name) primary text too low contrast")
            #expect(palette.color(.secondaryText).contrastRatio(against: background) >= 2.5,
                    "\(theme.name) secondary text too low contrast")
            #expect(palette.color(.onAccentText).contrastRatio(against: palette.color(.accent)) >= 3.0,
                    "\(theme.name) on-accent text too low contrast")
            #expect(palette.color(.surface) != background, "\(theme.name) surface not distinct from window")
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
