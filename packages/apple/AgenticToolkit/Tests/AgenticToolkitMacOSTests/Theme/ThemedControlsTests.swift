import Testing
import AppKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitCoreMacOS
@testable import AgenticToolkitMacOS

@MainActor
@Suite("Themed controls (color + typography + border)")
struct ThemedControlsTests {

    private var palette: SemanticPalette { SemanticPalette(theme: BuiltInThemes.solarizedDark) }
    private var lightPalette: SemanticPalette { SemanticPalette(theme: BuiltInThemes.solarizedLight) }

    @Test("ThemedLabel applies its color role and typography role")
    func label() {
        let label = ThemedLabel(string: "Hi", role: .secondaryText, textRole: .caption)
        label.applyTheme(palette)
        #expect(label.textColor == palette.nsColor(.secondaryText))
        #expect(label.font?.pointSize == palette.font(.caption).pointSize)
    }

    @Test("ThemedButton uses onAccent text and the button font")
    func button() {
        let button = ThemedButton(title: "Go")
        button.applyTheme(palette)
        let attrs = button.attributedTitle.attributes(at: 0, effectiveRange: nil)
        #expect((attrs[.foregroundColor] as? NSColor) == palette.onAccentTextColor)
        #expect((attrs[.font] as? NSFont)?.pointSize == palette.font(.button).pointSize)
    }

    @Test("ThemedTextField uses the control background and body font")
    func textField() {
        let field = ThemedTextField(string: "x")
        field.applyTheme(palette)
        #expect(field.backgroundColor == palette.controlBackgroundColor)
        #expect(field.font?.pointSize == palette.font(.body).pointSize)
    }

    @Test("ThemedBox strokes only when a stroke role is set, and tracks the palette")
    func box() {
        let bordered = ThemedBox(fill: .surface, stroke: .outline)
        bordered.applyTheme(palette)
        #expect(bordered.layer?.borderWidth == 1)
        let darkFill = bordered.layer?.backgroundColor
        bordered.applyTheme(lightPalette)
        #expect(bordered.layer?.backgroundColor != darkFill)   // wired to the palette

        let plain = ThemedBox(fill: .surface, stroke: nil)
        plain.applyTheme(palette)
        #expect(plain.layer?.borderWidth == 0)
    }
}
