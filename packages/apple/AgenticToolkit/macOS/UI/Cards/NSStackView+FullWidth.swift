import AppKit

extension NSStackView {

    /// Adds `view` as an arranged subview that fills the stack's width.
    ///
    /// A vertical stack's `.width` alignment only makes its arranged views equal
    /// to EACH OTHER — it does not tie them to the stack. So a stack stretched
    /// wider than its content (a card column in a window sized by its titlebar,
    /// say) leaves every view at its natural width and flushes the lot against
    /// one edge, which is not what "aligned to width" sounds like it promises.
    /// Pinning each view to the stack's own width is what actually makes a
    /// column fill, and it is why this exists rather than an `alignment` setting.
    ///
    /// The constraint is `.defaultHigh`, not required, so it only ever spends
    /// width the stack was already given: the stack's fitting size still comes
    /// from the content's own minimum, and a window that hugs its content keeps
    /// hugging it.
    public func addFullWidthArrangedSubview(_ view: NSView) {
        addArrangedSubview(view)
        let width = view.widthAnchor.constraint(
            equalTo: widthAnchor,
            constant: -(edgeInsets.left + edgeInsets.right)
        )
        width.priority = .defaultHigh
        width.isActive = true
    }
}
