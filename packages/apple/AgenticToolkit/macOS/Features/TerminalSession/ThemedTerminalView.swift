import AppKit
import Combine
import SwiftTerm

/// A `LocalProcessTerminalView` that decides whether its block caret is filled
/// or drawn as an outline.
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

    /// Everything the caret needs from the theme, in one value, because the
    /// colour and the shape are two halves of one decision: set the colour
    /// without the shape and the caret paints itself a lie until the next call.
    struct CaretAppearance {
        /// The caret's own colour — its fill when filled, its outline when not.
        var color: NSColor = .white
        /// The glyph under a caret that is *not* filled. Nothing is reversed
        /// out of an outline, so the character has to read as ordinary text.
        var textColor: NSColor = .white
        /// Hollow whatever else is true: the user picked an outline caret.
        var isAlwaysHollow = false
        /// A full block, which also says which pane the user is working in:
        /// filled here, an outline in every other pane.
        var marksActivePane = false
    }

    var caretAppearance = CaretAppearance() {
        didSet { updateCaret() }
    }

    private var isHollow = false
    private weak var cachedCaret: NSView?
    private var cancellables = Set<AnyCancellable>()

    override init(frame: CGRect) {
        super.init(frame: frame)
        // The active pane is tracked per window and moves under a click
        // anywhere in the app, so the caret cannot learn about it from its own
        // events — the pane that just *lost* the user sees no event at all.
        NotificationCenter.default.publisher(for: ComposableTabsActivePane.didChangeNotification)
            .sink { [weak self] notification in
                guard let self, let window = notification.object as? NSWindow,
                      window === self.window else { return }
                self.updateCaret()
            }
            .store(in: &cancellables)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        // Until it is in a window there is no pane to be active in, so this is
        // the first moment the question has an honest answer.
        updateCaret()
    }

    override func showCursor(source: Terminal) {
        super.showCursor(source: source)
        applyOutline()
    }

    override func cursorStyleChanged(source: Terminal, newStyle: CursorStyle) {
        super.cursorStyleChanged(source: source, newStyle: newStyle)
        applyOutline()
    }

    /// Re-decide fill vs. outline. Deliberately *not* on the `showCursor` path,
    /// which runs on every cursor movement: the two colours below are
    /// properties SwiftTerm holds on to, so they want writing when the answer
    /// changes rather than once a frame.
    private func updateCaret() {
        isHollow = caretAppearance.isAlwaysHollow
            || (caretAppearance.marksActivePane
                && !ComposableTabsActivePane.shared.isInActivePane(self))

        // A hollow caret has to lose SwiftTerm's own fill, or it shows through
        // the outline.
        caretColor = isHollow ? .clear : caretAppearance.color
        caretTextColor = isHollow ? caretAppearance.textColor : nil
        applyOutline()
    }

    private func applyOutline() {
        guard let caret = caretView else { return }

        caret.wantsLayer = true
        caret.layer?.borderWidth = isHollow ? Self.outlineWidth : 0
        caret.layer?.borderColor = isHollow ? caretAppearance.color.cgColor : nil
    }

    /// SwiftTerm adds its caret as a direct subview but exposes no accessor for
    /// it, so it is recognized by class name. A miss is not fatal — the caret
    /// just stays filled — which is why every caller of this `guard`s rather
    /// than asserting.
    ///
    /// Cached, because the search is not free and the caller is not rare:
    /// `showCursor` runs on every cursor movement, and
    /// `String(describing: type(of:))` demangles a metatype for each subview it
    /// passes — a per-keystroke cost for an answer that changes when SwiftTerm
    /// rebuilds its subviews and at no other time. Weak, and re-derived the
    /// moment the view it names is no longer ours, so a rebuild is picked up
    /// rather than remembered wrongly.
    private var caretView: NSView? {
        if let cachedCaret, cachedCaret.superview === self { return cachedCaret }
        let found = subviews.first {
            String(describing: type(of: $0)).hasSuffix("CaretView")
        }
        cachedCaret = found
        return found
    }

    private static let outlineWidth: CGFloat = 1
}
