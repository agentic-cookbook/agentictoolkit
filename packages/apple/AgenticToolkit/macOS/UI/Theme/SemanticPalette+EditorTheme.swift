import AppKit
import CodeEditSourceEditor

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The source editor's face of the app theme.
///
/// `CodeEditSourceEditor` asks for an `EditorTheme` — a fixed set of syntax
/// attributes — while the rest of the app reads a `SemanticPalette`. Deriving
/// one from the other is what keeps the file viewer inside the theme system
/// rather than carrying a second, hardcoded palette beside it (`dry`): pick a
/// theme and the editor follows it, imported `.itermcolors` schemes included.
///
/// Chrome comes from the semantic roles (`primaryText`, `cursor`, `selection`,
/// `surface`), because those *are* the app-wide meanings. Syntax colors come
/// from the ANSI 16 instead: "keyword" and "string" are not UI roles, and the
/// 16-slot palette is the vocabulary terminal-derived schemes — Solarized,
/// Dracula, Nord, Gruvbox — are actually authored in, so a scheme's own idea of
/// "green" is what strings end up painted with.
///
/// The bridge lives in `AgenticToolkitMacOS` rather than next to
/// `SemanticPalette+NSColor` in `AgenticToolkitCoreMacOS`, because that is the
/// only target that links `CodeEditSourceEditor`.
extension SemanticPalette {

    /// This palette expressed as a source-editor theme.
    public var editorTheme: EditorTheme {
        EditorTheme(
            text: .init(color: nsColor(.primaryText)),
            insertionPoint: nsColor(.cursor),
            invisibles: .init(color: nsColor(.placeholderText)),
            background: nsColor(.windowBackground),
            // The caret line sits one elevation above the backdrop, the same
            // relationship a panel has to the window.
            lineHighlight: nsColor(.surface),
            selection: nsColor(.selection),
            keywords: .init(color: ansiColor(5, or: .accent), bold: true),
            commands: .init(color: ansiColor(4, or: .accent)),
            types: .init(color: ansiColor(6, or: .info)),
            attributes: .init(color: ansiColor(3, or: .warning)),
            // `variables` also carries functions, methods and parameters — see
            // `EditorTheme.mapCapture` — so it takes a bright slot that reads
            // clearly at the density those appear in.
            variables: .init(color: ansiColor(12, or: .primaryText)),
            values: .init(color: ansiColor(11, or: .warning)),
            numbers: .init(color: ansiColor(9, or: .danger)),
            strings: .init(color: ansiColor(2, or: .success)),
            characters: .init(color: ansiColor(2, or: .success)),
            comments: .init(color: nsColor(.tertiaryText), italic: true)
        )
    }

    /// ANSI slot `index`, falling back to a semantic role when the theme is
    /// short of colors. A hand-authored or partially imported scheme is not
    /// guaranteed to carry all 16, and a missing slot must not blank out a
    /// whole syntax class.
    private func ansiColor(_ index: Int, or fallback: ThemeRole) -> NSColor {
        theme.ansiColor(at: index).map(NSColor.init) ?? nsColor(fallback)
    }
}
