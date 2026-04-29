import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

import AppKit
import Combine

/// In-memory log of summarizer activity, displayed in a debug window.
public final class SessionWatcherSummarizerDebugLog: ObservableObject, @unchecked Sendable {
    public static let shared = SessionWatcherSummarizerDebugLog()

    @Published private(set) var entries: [String] = []

    public func append(_ message: String) {
        let ts = Self.timestampFormatter.string(from: Date())
        let line = "[\(ts)] \(message)"
        if Thread.isMainThread {
            entries.append(line)
        } else {
            DispatchQueue.main.async { self.entries.append(line) }
        }
    }

    public func clear() {
        entries.removeAll()
    }

    private static let timestampFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss.SSS"
        return f
    }()
}

/// AppKit view showing the scrolling debug transcript.
public final class SessionWatcherSummarizerDebugView: NSView {
    private let log = SessionWatcherSummarizerDebugLog.shared
    private var cancellables = Set<AnyCancellable>()

    private let headerLabel = NSTextField(labelWithString: "Summarizer Debug Log")
    private let countLabel = NSTextField(labelWithString: "0 entries")
    private let clearButton = NSButton(title: "Clear", target: nil, action: nil)
    private let textView = NSTextView()
    private let scrollView = NSScrollView()
    private let emptyLabel = NSTextField(labelWithString: "No summarizer activity yet.")
    private let emptyHintLabel = NSTextField(wrappingLabelWithString:
        "Trigger a session end or right-click a session and choose \"Summarize with AI\".")

    public override init(frame: NSRect) {
        super.init(frame: frame)
        setupViews()
        bindLog()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        // Header
        headerLabel.font = .systemFont(ofSize: 12, weight: .semibold)
        headerLabel.translatesAutoresizingMaskIntoConstraints = false

        countLabel.font = .systemFont(ofSize: 11)
        countLabel.textColor = .secondaryLabelColor
        countLabel.translatesAutoresizingMaskIntoConstraints = false

        clearButton.font = .systemFont(ofSize: 11)
        clearButton.bezelStyle = .recessed
        clearButton.target = self
        clearButton.action = #selector(clearLog)
        clearButton.translatesAutoresizingMaskIntoConstraints = false

        let headerStack = NSStackView(views: [headerLabel, countLabel, clearButton])
        headerStack.orientation = .horizontal
        headerStack.spacing = 8
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        // Push count + clear to the right
        headerLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)

        let divider = NSBox()
        divider.boxType = .separator
        divider.translatesAutoresizingMaskIntoConstraints = false

        // Text view for log entries
        textView.isEditable = false
        textView.isSelectable = true
        textView.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 8, height: 8)

        scrollView.documentView = textView
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        // Empty state
        emptyLabel.font = .systemFont(ofSize: 12)
        emptyLabel.textColor = .secondaryLabelColor
        emptyLabel.alignment = .center
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false

        emptyHintLabel.font = .systemFont(ofSize: 11)
        emptyHintLabel.textColor = .tertiaryLabelColor
        emptyHintLabel.alignment = .center
        emptyHintLabel.translatesAutoresizingMaskIntoConstraints = false

        let emptyStack = NSStackView(views: [emptyLabel, emptyHintLabel])
        emptyStack.orientation = .vertical
        emptyStack.spacing = 8
        emptyStack.alignment = .centerX
        emptyStack.translatesAutoresizingMaskIntoConstraints = false

        addSubview(headerStack)
        addSubview(divider)
        addSubview(scrollView)
        addSubview(emptyStack)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            headerStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            headerStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),

            divider.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 8),
            divider.leadingAnchor.constraint(equalTo: leadingAnchor),
            divider.trailingAnchor.constraint(equalTo: trailingAnchor),

            scrollView.topAnchor.constraint(equalTo: divider.bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),

            emptyStack.centerXAnchor.constraint(equalTo: centerXAnchor),
            emptyStack.centerYAnchor.constraint(equalTo: centerYAnchor),
            emptyHintLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 300),
        ])
    }

    private func bindLog() {
        log.$entries
            .receive(on: DispatchQueue.main)
            .sink { [weak self] entries in
                self?.updateEntries(entries)
            }
            .store(in: &cancellables)
    }

    private func updateEntries(_ entries: [String]) {
        countLabel.stringValue = "\(entries.count) entries"

        if entries.isEmpty {
            scrollView.isHidden = true
            emptyLabel.isHidden = false
            emptyHintLabel.isHidden = false
            textView.string = ""
        } else {
            scrollView.isHidden = false
            emptyLabel.isHidden = true
            emptyHintLabel.isHidden = true

            // Only auto-scroll if already at the bottom
            let wasAtBottom = isScrolledToBottom
            textView.string = entries.joined(separator: "\n")
            if wasAtBottom {
                textView.scrollToEndOfDocument(nil)
            }
        }
    }

    private var isScrolledToBottom: Bool {
        let clipView = scrollView.contentView
        let docHeight = textView.frame.height
        let clipHeight = clipView.bounds.height
        let scrollY = clipView.bounds.origin.y
        // Consider "at bottom" if within 20pt of the end
        return docHeight <= clipHeight || scrollY >= (docHeight - clipHeight - 20)
    }

    @objc private func clearLog() {
        log.clear()
    }
}

/// AppKit window controller for the debug log.
@MainActor
public final class SessionWatcherSummarizerDebugWindowController: SingleWindowController {

    public static let windowID = "summarizerDebug"
    public static let windowSpec = WindowSpec(
        defaultSize: NSSize(width: 700, height: 500),
        minSize: NSSize(width: 400, height: 300),
        defaultPosition: .center,
        persistsFrame: true
    )

    public init() { super.init(windowID: Self.windowID, spec: Self.windowSpec) }

    public override var windowTitle: String { "Summarizer Debug Log" }
    public override var defaultContentRect: NSRect { NSRect(x: 0, y: 0, width: 700, height: 500) }
    public override var windowStyleMask: NSWindow.StyleMask {
        [.titled, .closable, .resizable, .miniaturizable]
    }

    public override func makeContentView() -> NSView? {
        SessionWatcherSummarizerDebugView(frame: .zero)
    }
}
