import AppKit

/// A chat message bubble with text and inline timestamp.
final class MessageBubbleView: NSView {

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }()

    init(message: ChatMessage, maxWidth: CGFloat) {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 12
        translatesAutoresizingMaskIntoConstraints = false

        let bgColor: NSColor
        let fgColor: NSColor
        switch message.role {
        case .user:
            bgColor = NSColor.controlAccentColor.withAlphaComponent(0.15)
            fgColor = .labelColor
        case .assistant:
            bgColor = NSColor.secondaryLabelColor.withAlphaComponent(0.08)
            fgColor = .labelColor
        case .error:
            bgColor = NSColor.systemRed.withAlphaComponent(0.08)
            fgColor = .systemRed
        }
        layer?.backgroundColor = bgColor.cgColor

        let textFont = NSFont.systemFont(ofSize: 13)
        let timeFont = NSFont.systemFont(ofSize: 10)
        let timeStr = "  " + Self.timeFormatter.string(from: message.timestamp)

        let attrStr = NSMutableAttributedString(
            string: message.text,
            attributes: [.font: textFont, .foregroundColor: fgColor]
        )
        attrStr.append(NSAttributedString(
            string: timeStr,
            attributes: [.font: timeFont, .foregroundColor: NSColor.tertiaryLabelColor]
        ))

        let hPad: CGFloat = 12
        let vPad: CGFloat = 8
        let textMaxWidth = maxWidth - hPad * 2

        // Calculate text size
        let textStorage = NSTextStorage(attributedString: attrStr)
        let layoutManager = NSLayoutManager()
        let textContainer = NSTextContainer(size: NSSize(width: textMaxWidth, height: .greatestFiniteMagnitude))
        textContainer.lineFragmentPadding = 0
        layoutManager.addTextContainer(textContainer)
        textStorage.addLayoutManager(layoutManager)
        layoutManager.ensureLayout(for: textContainer)
        let usedRect = layoutManager.usedRect(for: textContainer)
        let textWidth = ceil(usedRect.width)
        let textHeight = ceil(usedRect.height)

        let bubbleWidth = min(textWidth + hPad * 2, maxWidth)

        let textView = NSTextView(frame: .zero)
        textView.isEditable = false
        textView.isSelectable = true
        textView.drawsBackground = false
        textView.textContainerInset = .zero
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.size = NSSize(width: textWidth, height: .greatestFiniteMagnitude)
        textView.textStorage?.setAttributedString(attrStr)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.translatesAutoresizingMaskIntoConstraints = false

        addSubview(textView)

        NSLayoutConstraint.activate([
            textView.topAnchor.constraint(equalTo: topAnchor, constant: vPad),
            textView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: hPad),
            textView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -hPad),
            textView.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -vPad),
            textView.widthAnchor.constraint(equalToConstant: textWidth),
            textView.heightAnchor.constraint(equalToConstant: textHeight),
            widthAnchor.constraint(equalToConstant: bubbleWidth),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }
}
