import AppKit
import SwiftTerm

/// A `LocalProcessTerminalView` that can draw its block caret as an outline.
///
/// SwiftTerm's `CursorStyle` has no hollow-block case and its caret view is
/// internal, so the outline is a border on the caret's own layer rather than a
/// second caret of our own: position, size, and the blink animation stay
/// SwiftTerm's job (`native-controls`). Delete this the day upstream grows the
/// case (`design-for-deletion`).
///
/// Internal on purpose: a *public* NSView subclass would name
/// `LocalProcessTerminalView` in the framework's generated Objective-C header,
/// which then cannot find the Swift-only `SwiftTerm` module.
@MainActor
final class ThemedTerminalView: LocalProcessTerminalView {

    /// Draws the block caret as an outline instead of a filled rectangle.
    /// The caller is expected to set `caretColor` to clear alongside this, so
    /// SwiftTerm's own fill does not show through the outline.
    var usesHollowCaret = false {
        didSet { updateHollowCaret() }
    }

    /// Color of the outline. Separate from `caretColor` precisely because that
    /// one is cleared in hollow mode.
    var hollowCaretColor: NSColor = .white {
        didSet { updateHollowCaret() }
    }

    override func showCursor(source: Terminal) {
        super.showCursor(source: source)
        updateHollowCaret()
    }

    override func cursorStyleChanged(source: Terminal, newStyle: CursorStyle) {
        super.cursorStyleChanged(source: source, newStyle: newStyle)
        updateHollowCaret()
    }

    /// SwiftTerm adds its caret as a direct subview but exposes no accessor for
    /// it, so it is recognized by class name. A miss is not fatal — the caret
    /// just stays filled — which is why this is a `guard`, not a precondition.
    private func updateHollowCaret() {
        guard let caret = subviews.first(where: {
            String(describing: type(of: $0)).hasSuffix("CaretView")
        }) else { return }

        caret.wantsLayer = true
        caret.layer?.borderWidth = usesHollowCaret ? Self.outlineWidth : 0
        caret.layer?.borderColor = usesHollowCaret ? hollowCaretColor.cgColor : nil
    }

    private static let outlineWidth: CGFloat = 1
}
