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

    /// The transcript width the bubbles were last laid out for. Bubbles bake in a
    /// fixed width at build time (their text is pre-measured), so we rebuild them
    /// when the width changes — see `layout()` — to keep them proportional on resize.
    private var lastTranscriptWidth: CGFloat = 0

    /// Bubbles cap at this fraction of the transcript width, so they read as chat
    /// bubbles and grow/shrink with the window rather than spanning it.
    private static let maxBubbleWidthFraction: CGFloat = 0.75

    public init(viewModel: ChatViewModel) {
        self.viewModel = viewModel
        super.init(frame: .zero)
        setupViews()
        bindViewModel()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

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
        inputField.accessibilityID("ai-chat.input")

        sendButton.image = NSImage(systemSymbolName: "arrow.up.circle.fill", accessibilityDescription: "Send")
        sendButton.symbolConfiguration = .init(pointSize: 18, weight: .regular)
        sendButton.isBordered = false
        sendButton.target = self
        sendButton.action = #selector(sendTapped)
        sendButton.translatesAutoresizingMaskIntoConstraints = false
        sendButton.accessibilityID("ai-chat.send-button")

        let inputRow = NSStackView(views: [inputField, sendButton])
        inputRow.orientation = .horizontal
        inputRow.spacing = 10
        inputRow.edgeInsets = NSEdgeInsets(top: 14, left: 16, bottom: 14, right: 16)
        inputRow.translatesAutoresizingMaskIntoConstraints = false

        let topAnchorView: NSView = self

        addSubview(transcriptScroll)
        addSubview(divider)
        addSubview(inputRow)

        NSLayoutConstraint.activate([
            transcriptScroll.topAnchor.constraint(equalTo: topAnchorView.topAnchor),
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
            inputRow.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    /// Rebuild the transcript when the transcript width changes (window resize),
    /// so the pre-measured bubbles reflow to the new proportional width. Guarded on
    /// a width delta so the rebuild's own relayout doesn't recurse.
    public override func layout() {
        super.layout()
        let width = transcriptScroll.contentView.bounds.width
        if width > 0, abs(width - lastTranscriptWidth) > 1 {
            lastTranscriptWidth = width
            rebuildTranscript()
        }
    }

    private func bindViewModel() {
        viewModel.$messages
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.scheduleRender() }
            .store(in: &cancellables)

        viewModel.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.scheduleRender() }
            .store(in: &cancellables)
    }

    /// Coalesce high-frequency delta updates into one rebuild per runloop tick.
    private var renderScheduled = false
    private func scheduleRender() {
        guard !renderScheduled else { return }
        renderScheduled = true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.renderScheduled = false
            self.rebuildTranscript()
        }
    }

    // MARK: - Transcript

    private func rebuildTranscript() {
        transcriptStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        let scrollWidth = transcriptScroll.contentView.bounds.width
        let maxBubbleWidth = max(scrollWidth * Self.maxBubbleWidthFraction, 200)

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

        let responding = viewModel.state == .responding
        if responding {
            let indicator = TypingIndicatorView()
            transcriptStack.addArrangedSubview(indicator)
            indicator.startAnimating()
        }

        // Disable input controls while responding so rapid sends can't overlap turns.
        inputField.isEnabled = !responding
        sendButton.isEnabled = !responding

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
