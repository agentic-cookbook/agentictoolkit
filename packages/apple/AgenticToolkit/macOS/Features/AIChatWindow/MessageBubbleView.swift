import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// A chat message bubble with text and inline timestamp.
///
/// The explicit Objective-C name is not decoration. `AgenticDeveloperToolkitUI`
/// ships a `MessageBubbleView` of its own, and this framework `@_exported`
/// imports it — two Swift types in different modules, but one Objective-C
/// class name, and the generated compatibility headers collide the moment an
/// Objective-C translation unit sees both. The toolkit that ships to customers
/// keeps the plain name; this one, an app feature, takes the qualified one.
@objc(AgenticToolkitMessageBubbleView)
public final class MessageBubbleView: NSView {

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    private let message: ChatMessage
    private let maxWidth: CGFloat

    private let textView = NSTextView(frame: .zero)

    // The bubble sizes itself to its text, and the theme owns the font, so the
    // measurement has to be redone on every theme change rather than baked in
    // at init. These three constraints are what that re-measurement writes.
    private let textWidthConstraint: NSLayoutConstraint
    private let textHeightConstraint: NSLayoutConstraint
    private var bubbleWidthConstraint: NSLayoutConstraint!

    private static let hPad: CGFloat = 12
    private static let vPad: CGFloat = 8

    public init(message: ChatMessage, maxWidth: CGFloat) {
        self.message = message
        self.maxWidth = maxWidth
        self.textWidthConstraint = textView.widthAnchor.constraint(equalToConstant: 0)
        self.textHeightConstraint = textView.heightAnchor.constraint(equalToConstant: 0)

        super.init(frame: .zero)
        self.bubbleWidthConstraint = widthAnchor.constraint(equalToConstant: maxWidth)

        wantsLayer = true
        layer?.cornerRadius = 12
        translatesAutoresizingMaskIntoConstraints = false

        textView.isEditable = false
        textView.isSelectable = true
        textView.drawsBackground = false
        textView.textContainerInset = .zero
        textView.textContainer?.lineFragmentPadding = 0
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.translatesAutoresizingMaskIntoConstraints = false

        addSubview(textView)

        NSLayoutConstraint.activate([
            textView.topAnchor.constraint(equalTo: topAnchor, constant: Self.vPad),
            textView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: Self.hPad),
            textView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -Self.hPad),
            textView.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -Self.vPad),
            textWidthConstraint,
            textHeightConstraint,
            bubbleWidthConstraint
        ])

        observeTheme { bubble, palette in bubble.apply(palette) }
    }

    /// The bubble's fill and text color for this message's role.
    ///
    /// Roles map onto semantic roles rather than stock system colors: a user
    /// message is the theme's accent, an error is `danger`, a notice is
    /// secondary. The fills are the same color at low alpha so a bubble reads as
    /// a tint of its meaning against whatever surface the theme puts behind it.
    private func colors(from palette: SemanticPalette) -> (fill: NSColor, text: NSColor) {
        switch message.role {
        case .user:
            return (palette.nsColor(.accent).withAlphaComponent(0.15), palette.nsColor(.primaryText))
        case .assistant:
            return (palette.nsColor(.secondaryText).withAlphaComponent(0.08), palette.nsColor(.primaryText))
        case .error:
            return (palette.nsColor(.danger).withAlphaComponent(0.08), palette.nsColor(.danger))
        case .notice:
            return (palette.nsColor(.secondaryText).withAlphaComponent(0.10), palette.nsColor(.secondaryText))
        }
    }

    private func attributedText(for palette: SemanticPalette) -> NSAttributedString {
        let (_, textColor) = colors(from: palette)
        let bodyFont = palette.font(.body)
        // The timestamp is deliberately smaller than the body it trails; the
        // theme's caption style is that relationship expressed once.
        let timeFont = palette.font(.caption)

        let string = NSMutableAttributedString(
            string: message.text,
            attributes: [.font: bodyFont, .foregroundColor: textColor]
        )
        string.append(NSAttributedString(
            string: "  " + Self.timeFormatter.string(from: message.timestamp),
            attributes: [.font: timeFont, .foregroundColor: palette.nsColor(.tertiaryText)]
        ))
        return string
    }

    private func apply(_ palette: SemanticPalette) {
        layer?.backgroundColor = colors(from: palette).fill.cgColor

        let attributed = attributedText(for: palette)
        let textMaxWidth = maxWidth - Self.hPad * 2

        // Measure off-screen in a throwaway layout stack rather than asking the
        // live text view, whose container is about to be resized to the answer.
        let textStorage = NSTextStorage(attributedString: attributed)
        let layoutManager = NSLayoutManager()
        let textContainer = NSTextContainer(
            size: NSSize(width: textMaxWidth, height: .greatestFiniteMagnitude)
        )
        textContainer.lineFragmentPadding = 0
        layoutManager.addTextContainer(textContainer)
        textStorage.addLayoutManager(layoutManager)
        layoutManager.ensureLayout(for: textContainer)
        let usedRect = layoutManager.usedRect(for: textContainer)
        let textWidth = ceil(usedRect.width)
        let textHeight = ceil(usedRect.height)

        textView.textContainer?.size = NSSize(width: textWidth, height: .greatestFiniteMagnitude)
        textView.textStorage?.setAttributedString(attributed)

        textWidthConstraint.constant = textWidth
        textHeightConstraint.constant = textHeight
        bubbleWidthConstraint.constant = min(textWidth + Self.hPad * 2, maxWidth)

        textView.insertionPointColor = palette.nsColor(.cursor)
        textView.selectedTextAttributes = [
            .backgroundColor: palette.nsColor(.selection),
            .foregroundColor: palette.nsColor(.selectionText)
        ]
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }
}
