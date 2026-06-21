import Testing
import Foundation
@testable import AgenticToolkitCore

@Suite("SemanticPalette roles + contrast")
struct SemanticPaletteRolesTests {

    private func theme(
        background: String, foreground: String,
        accent: String = "#268bd2", selection: String = "#445566"
    ) -> ColorTheme {
        var ansi = (0..<16).map { _ in RGBAColor(hexString: "#808080ff")! }
        ansi[4] = RGBAColor(hexString: accent + "ff")!
        return ColorTheme(
            name: "T", appearance: .dark,
            foreground: RGBAColor(hexString: foreground + "ff")!,
            background: RGBAColor(hexString: background + "ff")!,
            cursor: RGBAColor(hexString: foreground + "ff")!,
            selection: RGBAColor(hexString: selection + "ff")!,
            ansi: ansi
        )
    }

    @Test("contrastRatio matches WCAG extremes")
    func contrastExtremes() {
        let black = RGBAColor(hexString: "#000000ff")!
        let white = RGBAColor(hexString: "#ffffffff")!
        #expect(black.contrastRatio(against: white) > 20)        // ~21:1
        #expect(abs(white.contrastRatio(against: white) - 1.0) < 0.0001)
    }

    @Test("every role resolves and the role set is the full expanded set")
    func allRolesResolve() {
        let palette = SemanticPalette(theme: theme(background: "#1e1e2e", foreground: "#cdd6f4"))
        for role in ThemeRole.allCases { _ = palette.color(role) }
        #expect(ThemeRole.allCases.count >= 20)
        // the new roles exist
        let names = Set(ThemeRole.allCases.map(\.rawValue))
        for new in ["elevatedSurface", "controlBackground", "placeholderText",
                    "onAccentText", "outline", "divider"] {
            #expect(names.contains(new))
        }
    }

    @Test("new-role overrides win over derivation")
    func newRoleOverrides() {
        var custom = theme(background: "#1e1e2e", foreground: "#cdd6f4")
        let red = RGBAColor(hexString: "#ff0000ff")!
        custom.roleOverrides[ThemeRole.outline.rawValue] = red
        custom.roleOverrides[ThemeRole.elevatedSurface.rawValue] = red
        let palette = SemanticPalette(theme: custom)
        #expect(palette.color(.outline) == red)
        #expect(palette.color(.elevatedSurface) == red)
    }

    @Test("surfaces layer away from the window background")
    func surfacesLayered() {
        let palette = SemanticPalette(theme: theme(background: "#1e1e2e", foreground: "#cdd6f4"))
        let bgLum = palette.color(.windowBackground).relativeLuminance
        #expect(palette.color(.surface) != palette.color(.windowBackground))
        #expect(palette.color(.elevatedSurface) != palette.color(.surface))
        // dark theme → elevated surfaces are lighter than the window backdrop
        #expect(palette.color(.elevatedSurface).relativeLuminance > bgLum)
    }

    @Test("secondary/tertiary text meet legibility floors but stay dimmer than primary")
    func textContrastFloors() {
        let palette = SemanticPalette(theme: theme(background: "#1e1e2e", foreground: "#cdd6f4"))
        let background = palette.color(.windowBackground)
        let primary = palette.color(.primaryText).contrastRatio(against: background)
        let secondary = palette.color(.secondaryText).contrastRatio(against: background)
        let tertiary = palette.color(.tertiaryText).contrastRatio(against: background)
        #expect(secondary >= 3.0)
        #expect(tertiary >= 2.0)
        #expect(secondary <= primary)
        #expect(tertiary <= secondary)
    }

    @Test("onAccentText and selectionText are readable on their fills")
    func readableOnFills() {
        let palette = SemanticPalette(theme: theme(background: "#1e1e2e", foreground: "#cdd6f4",
                                                   accent: "#0a7aff", selection: "#3355ff"))
        #expect(palette.color(.onAccentText).contrastRatio(against: palette.color(.accent)) >= 4.5)
        #expect(palette.color(.selectionText).contrastRatio(against: palette.color(.selection)) >= 4.5)
    }
}
