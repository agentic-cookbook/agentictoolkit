import AppKit
import os
import AgenticToolkitCore

/// A small floating window for quickly capturing a note.
/// Positions itself near a given screen rect (typically a status bar item).
public final class QuickNoteWindowController: NSWindowController {

    // MARK: - Callback

    /// Called when the user saves. Provides (title, content).
    /// Required at init time — a silently-dropped save is a terrible UX.
    private let onSave: (String, String) -> Void

    // MARK: - Views

    private lazy var titleField: NSTextField = {
        let field = NSTextField()
        field.placeholderString = "Note title..."
        field.bezelStyle = .roundedBezel
        field.font = .systemFont(ofSize: 14, weight: .medium)
        field.translatesAutoresizingMaskIntoConstraints = false
        return field
    }()

    private lazy var contentScrollView: NSScrollView = {
        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.borderType = .bezelBorder
        scroll.translatesAutoresizingMaskIntoConstraints = false
        return scroll
    }()

    private lazy var contentTextView: NSTextView = {
        let textView = NSTextView()
        textView.isEditable = true
        textView.isSelectable = true
        textView.isRichText = false
        textView.font = .systemFont(ofSize: 13)
        textView.textContainerInset = NSSize(width: 6, height: 6)
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.allowsUndo = true
        return textView
    }()

    private lazy var saveButton: NSButton = {
        let btn = NSButton(title: "Save", target: self, action: #selector(saveAction))
        btn.keyEquivalent = "\r"
        btn.keyEquivalentModifierMask = [.command]
        btn.translatesAutoresizingMaskIntoConstraints = false
        return btn
    }()

    private lazy var cancelButton: NSButton = {
        let btn = NSButton(title: "Cancel", target: self, action: #selector(cancelAction))
        btn.keyEquivalent = "\u{1b}"
        btn.translatesAutoresizingMaskIntoConstraints = false
        return btn
    }()

    // MARK: - Initialization

    public init(onSave: @escaping (String, String) -> Void) {
        self.onSave = onSave

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 360, height: 260),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "Quick Note"
        window.level = .floating
        window.isReleasedWhenClosed = false
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        super.init(window: window)

        setupContentView()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    // MARK: - Layout

    private func setupContentView() {
        guard let contentView = window?.contentView else { return }
        contentScrollView.documentView = contentTextView

        contentView.addSubview(titleField)
        contentView.addSubview(contentScrollView)
        contentView.addSubview(cancelButton)
        contentView.addSubview(saveButton)

        NSLayoutConstraint.activate([
            titleField.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 16),
            titleField.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            titleField.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),

            contentScrollView.topAnchor.constraint(equalTo: titleField.bottomAnchor, constant: 8),
            contentScrollView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            contentScrollView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            contentScrollView.bottomAnchor.constraint(equalTo: cancelButton.topAnchor, constant: -12),

            cancelButton.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -16),
            cancelButton.trailingAnchor.constraint(equalTo: saveButton.leadingAnchor, constant: -8),

            saveButton.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -16),
            saveButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            saveButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 60)
        ])
    }

    // MARK: - Show

    /// Positions near the menu bar status item button and shows the window.
    public func showNearStatusItem(buttonFrame: NSRect) {
        titleField.stringValue = ""
        contentTextView.string = ""

        guard let window else { return }
        let wSize = window.frame.size

        // Choose the screen containing the button, falling back to main.
        // If neither is available (headless, screensaver), just center the window.
        let targetScreen = NSScreen.screens.first(where: { $0.frame.contains(buttonFrame) })
            ?? NSScreen.main
        if let screenFrame = targetScreen?.visibleFrame {
            var origin = NSPoint(
                x: buttonFrame.maxX - wSize.width,
                y: buttonFrame.minY - wSize.height - 4
            )
            origin.x = max(screenFrame.minX + 8, min(origin.x, screenFrame.maxX - wSize.width - 8))
            origin.y = max(screenFrame.minY + 8, origin.y)
            window.setFrameOrigin(origin)
        } else {
            window.center()
        }
        showWindow(nil)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        window.makeFirstResponder(titleField)
        logger.debug("Quick note window shown")
    }

    // MARK: - Actions

    @objc private func saveAction() {
        let title = titleField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let content = contentTextView.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty || !content.isEmpty else {
            close()
            return
        }
        onSave(title.isEmpty ? "Quick Note" : title, content)
        close()
    }

    @objc private func cancelAction() {
        close()
    }
}

extension QuickNoteWindowController: Loggable {
    public static nonisolated let logger = makeLogger()
}
