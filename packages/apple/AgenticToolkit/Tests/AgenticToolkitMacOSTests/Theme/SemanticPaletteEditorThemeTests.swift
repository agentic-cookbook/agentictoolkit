import Testing
import AppKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitCoreMacOS
@testable import AgenticToolkitMacOS

/// The source editor is themed by the app's theme, not by a palette of its own.
/// These pin the two halves of that: chrome comes from the semantic roles, and
/// syntax comes from the theme's own ANSI colors, so a theme switch — including
/// to an imported `.itermcolors` scheme — actually repaints the editor.
@MainActor
@Suite("SemanticPalette → EditorTheme")
struct SemanticPaletteEditorThemeTests {

    private func palette(_ theme: ColorTheme) -> SemanticPalette { SemanticPalette(theme: theme) }

    @Test("chrome comes from the semantic roles")
    func chrome() {
        let palette = palette(BuiltInThemes.dracula)
        let editor = palette.editorTheme

        #expect(editor.background == palette.nsColor(.windowBackground))
        #expect(editor.text.color == palette.nsColor(.primaryText))
        #expect(editor.insertionPoint == palette.nsColor(.cursor))
        #expect(editor.selection == palette.nsColor(.selection))
        #expect(editor.lineHighlight == palette.nsColor(.surface))
    }

    @Test("syntax colors come from the theme's own ANSI palette")
    func syntax() throws {
        let theme = BuiltInThemes.dracula
        let editor = palette(theme).editorTheme

        #expect(editor.keywords.color == NSColor(try #require(theme.ansiColor(at: 5))))
        #expect(editor.strings.color == NSColor(try #require(theme.ansiColor(at: 2))))
        #expect(editor.characters.color == editor.strings.color)
        #expect(editor.types.color == NSColor(try #require(theme.ansiColor(at: 6))))
        #expect(editor.numbers.color == NSColor(try #require(theme.ansiColor(at: 9))))
    }

    @Test("keywords are bold and comments italic, so weight survives a theme swap")
    func emphasis() {
        let editor = palette(BuiltInThemes.solarizedLight).editorTheme
        #expect(editor.keywords.bold)
        #expect(editor.comments.italic)
        #expect(editor.text.bold == false)
    }

    @Test("switching themes changes the editor theme")
    func followsTheTheme() {
        #expect(palette(BuiltInThemes.dracula).editorTheme != palette(BuiltInThemes.solarizedLight).editorTheme)
    }

    /// A hand-authored or partially imported scheme need not carry all 16 ANSI
    /// slots. A missing slot must fall back to a semantic role rather than
    /// blanking out a whole syntax class.
    @Test("a theme short of ANSI colors falls back to semantic roles")
    func shortPalette() {
        var theme = BuiltInThemes.dracula
        theme.ansi = []
        let palette = palette(theme)
        let editor = palette.editorTheme

        #expect(editor.keywords.color == palette.nsColor(.accent))
        #expect(editor.strings.color == palette.nsColor(.success))
        #expect(editor.numbers.color == palette.nsColor(.danger))
        #expect(editor.types.color == palette.nsColor(.info))
    }
}
