import AppKit
import Combine

/// A chat view with transcript, message bubbles, typing indicator, and input field.
public final class ChatView: NSView, NSTextFieldDelegate {
    private let viewModel: ChatViewModel
    private var cancellables = Set<AnyCancellable>()

    private let transcriptScroll = NSScrollView()
    private let transcriptStack = NSStackView()
    private let inputField = NSTextField()
    private let sendButton = NSButton()
    private var isAtBottom = true

    public init(viewModel: ChatViewModel) {
        self.viewModel = viewModel
        super.init(frame: .zero)
        setupViews()
        bindViewModel()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    // MARK: - Layout

    private func setupViews() {
        transcriptStack.orientation = .vertical
        transcriptStack.spacing = 12
        transcriptStack.alignment = .leading
        transcriptStack.edgeInsets = NSEdgeInsets(top: 20, left: 16, bottom: 20, right: 16)
        transcriptStack.translatesAutoresizingMaskIntoConstraints = false

        transcriptScroll.documentView = transcriptStack
        transcriptScroll.hasVerticalScroller = true
        transcriptScroll.automaticallyAdjustsContentInsets = false
        transcriptScroll.drawsBackground = false
        transcriptScroll.translatesAutoresizingMaskIntoConstraints = false

        transcriptScroll.contentView.postsBoundsChangedNotifications = true
        NotificationCenter.default.addObserver(
            self, selector: #selector(transcriptDidScroll),
            name: NSView.boundsDidChangeNotification,
            object: transcriptScroll.contentView
        )

        let divider = NSBox()
        divider.boxType = .separator
        divider.translatesAutoresizingMaskIntoConstraints = false

        inputField.placeholderString = "Type a message..."
        inputField.font = .systemFont(ofSize: 13)
        inputField.isBordered = false
        inputField.focusRingType = .none
        inputField.drawsBackground = false
        inputField.delegate = self
        inputField.translatesAutoresizingMaskIntoConstraints = false

        sendButton.image = NSImage(systemSymbolName: "arrow.up.circle.fill", accessibilityDescription: "Send")
        sendButton.symbolConfiguration = .init(pointSize: 18, weight: .regular)
        sendButton.isBordered = false
        sendButton.target = self
        sendButton.action = #selector(sendTapped)
        sendButton.translatesAutoresizingMaskIntoConstraints = false

        let inputRow = NSStackView(views: [inputField, sendButton])
        inputRow.orientation = .horizontal
        inputRow.spacing = 10
        inputRow.edgeInsets = NSEdgeInsets(top: 14, left: 16, bottom: 14, right: 16)
        inputRow.translatesAutoresizingMaskIntoConstraints = false

        addSubview(transcriptScroll)
        addSubview(divider)
        addSubview(inputRow)

        NSLayoutConstraint.activate([
            transcriptScroll.topAnchor.constraint(equalTo: topAnchor),
            transcriptScroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            transcriptScroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            transcriptScroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 200),
            transcriptStack.widthAnchor.constraint(equalTo: transcriptScroll.widthAnchor),
            divider.topAnchor.constraint(equalTo: transcriptScroll.bottomAnchor),
            divider.leadingAnchor.constraint(equalTo: leadingAnchor),
            divider.trailingAnchor.constraint(equalTo: trailingAnchor),
            inputRow.topAnchor.constraint(equalTo: divider.bottomAnchor),
            inputRow.leadingAnchor.constraint(equalTo: leadingAnchor),
            inputRow.trailingAnchor.constraint(equalTo: trailingAnchor),
            inputRow.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    private func bindViewModel() {
        viewModel.$messages
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.rebuildTranscript() }
            .store(in: &cancellables)

        viewModel.$isTyping
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.rebuildTranscript() }
            .store(in: &cancellables)
    }

    // MARK: - Transcript

    private func rebuildTranscript() {
        transcriptStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        let scrollWidth = transcriptScroll.contentView.bounds.width
        let maxBubbleWidth = max(scrollWidth - 32 - 16, 200)

        let topSpacer = NSView()
        topSpacer.translatesAutoresizingMaskIntoConstraints = false
        topSpacer.setContentHuggingPriority(.init(1), for: .vertical)
        topSpacer.setContentCompressionResistancePriority(.init(1), for: .vertical)
        transcriptStack.addArrangedSubview(topSpacer)

        for message in viewModel.messages {
            let bubble = MessageBubbleView(message: message, maxWidth: maxBubbleWidth)
            bubble.setContentHuggingPriority(.required, for: .horizontal)

            if message.role == .user {
                let spacer = NSView()
                spacer.translatesAutoresizingMaskIntoConstraints = false
                spacer.widthAnchor.constraint(greaterThanOrEqualToConstant: 60).isActive = true
                let hStack = NSStackView(views: [spacer, bubble])
                hStack.orientation = .horizontal
                hStack.alignment = .top
                hStack.spacing = 0
                transcriptStack.addArrangedSubview(hStack)
                hStack.widthAnchor.constraint(equalTo: transcriptStack.widthAnchor, constant: -32).isActive = true
            } else {
                transcriptStack.addArrangedSubview(bubble)
            }
        }

        if viewModel.isTyping {
            let indicator = TypingIndicatorView()
            transcriptStack.addArrangedSubview(indicator)
            indicator.startAnimating()
        }

        if isAtBottom {
            DispatchQueue.main.async { [weak self] in self?.scrollToBottom() }
        }
    }

    // MARK: - Scroll

    @objc private func transcriptDidScroll() {
        guard let docView = transcriptScroll.documentView else { return }
        let clip = transcriptScroll.contentView
        let visibleBottom = clip.bounds.origin.y + clip.bounds.height
        let contentHeight = docView.bounds.height
        isAtBottom = contentHeight - visibleBottom < 30
    }

    private func scrollToBottom() {
        guard let docView = transcriptScroll.documentView else { return }
        let maxScroll = max(docView.bounds.height - transcriptScroll.contentView.bounds.height, 0)
        transcriptScroll.contentView.scroll(to: NSPoint(x: 0, y: maxScroll))
        transcriptScroll.reflectScrolledClipView(transcriptScroll.contentView)
    }

    // MARK: - Input

    @objc private func sendTapped() {
        let text = inputField.stringValue
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        viewModel.sendMessage(text)
        inputField.stringValue = ""
    }

    public func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        if commandSelector == #selector(NSResponder.insertNewline(_:)) {
            sendTapped()
            return true
        }
        return false
    }
}
