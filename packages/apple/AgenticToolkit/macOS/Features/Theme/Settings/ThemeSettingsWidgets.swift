import AppKit

/// A document view that pins its content to the top (AppKit's default flips the
/// origin to the bottom-left). Used as the scroll document for the theme gallery.
final class ThemeFlippedView: NSView {
    override var isFlipped: Bool { true }
}

/// Progressive disclosure: an HIG disclosure triangle + label that show/hide a
/// content view. Clicking either the triangle or the label toggles the section.
/// (Theme-prefixed to avoid clashing with SwiftUI's `DisclosureGroup`.)
final class ThemeDisclosureGroup: NSView {
    private let triangle = NSButton()
    private let body: NSView

    init(title: String, content: NSView, expanded: Bool) {
        self.body = content
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        triangle.title = title
        triangle.setButtonType(.onOff)
        triangle.bezelStyle = .disclosure
        triangle.state = expanded ? .on : .off
        triangle.target = self
        triangle.action = #selector(toggle)
        triangle.translatesAutoresizingMaskIntoConstraints = false

        let label = NSTextField(labelWithString: title)
        label.font = .systemFont(ofSize: 12, weight: .semibold)
        let labelClick = NSClickGestureRecognizer(target: self, action: #selector(toggle))
        label.addGestureRecognizer(labelClick)

        let header = NSStackView(views: [triangle, label])
        header.orientation = .horizontal
        header.spacing = 4
        header.translatesAutoresizingMaskIntoConstraints = false

        content.translatesAutoresizingMaskIntoConstraints = false
        content.isHidden = !expanded

        addSubview(header)
        addSubview(content)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: topAnchor),
            header.leadingAnchor.constraint(equalTo: leadingAnchor),
            content.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 8),
            content.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            content.trailingAnchor.constraint(equalTo: trailingAnchor),
            content.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    @objc private func toggle() {
        // Expand iff currently collapsed; keep the triangle state in sync whether
        // the triangle button or the label was clicked.
        let expand = body.isHidden
        body.isHidden = !expand
        triangle.state = expand ? .on : .off
    }
}
