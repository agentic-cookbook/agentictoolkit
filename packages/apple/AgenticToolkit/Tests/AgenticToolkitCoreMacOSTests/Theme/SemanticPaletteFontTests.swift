import Testing
import AppKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitCoreMacOS

@Suite("SemanticPalette fonts + new colors")
struct SemanticPaletteFontTests {

    private func sampleTheme(typography: ThemeTypography = .system) -> ColorTheme {
        ColorTheme(
            name: "T", appearance: .dark,
            foreground: RGBAColor(hexString: "#ffffffff")!,
            background: RGBAColor(hexString: "#000000ff")!,
            cursor: RGBAColor(hexString: "#ffffffff")!,
            selection: RGBAColor(hexString: "#333333ff")!,
            ansi: Array(repeating: RGBAColor(hexString: "#808080ff")!, count: 16),
            typography: typography
        )
    }

    @Test("resolves each text role to a font at its scaled size")
    func fontSizes() {
        let palette = SemanticPalette(theme: sampleTheme())
        #expect(palette.font(.body).pointSize == 13)
        #expect(palette.font(.title).pointSize == 22)
    }

    @Test("global sizeScale scales every role's font")
    func scaled() {
        var typo = ThemeTypography.system
        typo.sizeScale = 2.0
        let palette = SemanticPalette(theme: sampleTheme(typography: typo))
        #expect(palette.font(.body).pointSize == 26)
    }

    @Test("the code role resolves to a monospaced font")
    func mono() {
        let palette = SemanticPalette(theme: sampleTheme())
        #expect(palette.font(.code).fontDescriptor.symbolicTraits.contains(.monoSpace))
    }

    @Test("a custom family is honored when installed")
    func customFamily() {
        var typo = ThemeTypography.system
        typo.styles[TextRole.body.rawValue] = FontStyle(family: "Menlo", size: 14, weight: .regular)
        let palette = SemanticPalette(theme: sampleTheme(typography: typo))
        #expect(palette.font(.body).familyName == "Menlo")
    }

    @Test("the new color roles bridge to NSColor")
    func newColors() {
        let palette = SemanticPalette(theme: sampleTheme())
        // Just exercise the accessors — they must exist and not crash.
        _ = palette.elevatedSurfaceColor
        _ = palette.controlBackgroundColor
        _ = palette.placeholderTextColor
        _ = palette.onAccentTextColor
        _ = palette.outlineColor
        _ = palette.dividerColor
        #expect(palette.outlineColor != palette.borderColor)
    }
}
