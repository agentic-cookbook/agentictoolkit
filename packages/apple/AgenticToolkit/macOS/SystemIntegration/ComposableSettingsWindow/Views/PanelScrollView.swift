import AppKit

extension ComposableSettings {

    /// The canonical scroll host for panel content: a flipped document so content
    /// top-anchors (settings read top-to-bottom), content width pinned to the
    /// viewport (fills + wrapping labels wrap; the content's fitting size never
    /// drives the pane or the window) and height at least the viewport (fills, or
    /// scrolls vertically when taller). `SplitViewController` wraps every
    /// non-self-scrolling panel in one; master/detail pickers host their detail
    /// panes in one so rebuilt content can never tug the divider.
    @MainActor
    public final class PanelScrollView: NSScrollView {

        private let document = FlippedDocumentView()

        public init() {
            super.init(frame: .zero)
            translatesAutoresizingMaskIntoConstraints = false
            drawsBackground = false
            hasVerticalScroller = true
            hasHorizontalScroller = true
            autohidesScrollers = true
            document.translatesAutoresizingMaskIntoConstraints = false
            documentView = document
            NSLayoutConstraint.activate([
                document.topAnchor.constraint(equalTo: contentView.topAnchor),
                document.leadingAnchor.constraint(equalTo: contentView.leadingAnchor)
            ])
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        /// Install `view` as the hosted content, replacing any previous content
        /// (and thereby resetting the scroll position to the top).
        public func setContent(_ view: NSView) {
            document.subviews.forEach { $0.removeFromSuperview() }
            view.translatesAutoresizingMaskIntoConstraints = false
            document.addSubview(view)
            NSLayoutConstraint.activate([
                view.topAnchor.constraint(equalTo: document.topAnchor),
                view.leadingAnchor.constraint(equalTo: document.leadingAnchor),
                view.trailingAnchor.constraint(equalTo: document.trailingAnchor),
                view.bottomAnchor.constraint(equalTo: document.bottomAnchor),
                view.widthAnchor.constraint(equalTo: contentView.widthAnchor),
                view.heightAnchor.constraint(greaterThanOrEqualTo: contentView.heightAnchor)
            ])
        }
    }
}

/// Flipped so a scroll view's document top-aligns its content (settings read
/// top-to-bottom) instead of AppKit's default bottom-up origin.
private final class FlippedDocumentView: NSView {
    override var isFlipped: Bool { true }
}
