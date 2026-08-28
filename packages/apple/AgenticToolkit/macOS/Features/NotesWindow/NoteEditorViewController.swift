import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

@MainActor public protocol NoteEditorViewControllerDelegate: AnyObject {
    func noteEditorDidChangeTitle(_ title: String, for noteID: UUID)
    func noteEditorDidChangeContent(_ content: String, for noteID: UUID)
    func noteEditorDidRequestPin(for noteID: UUID)
    func noteEditorDidRequestDelete(for noteID: UUID)
}

public final class NoteEditorViewController: NSViewController {

    // MARK: - Public API

    public weak var delegate: NoteEditorViewControllerDelegate?

    /// Call to display a note in the editor, or nil to show the empty state.
    public func show(note: Note?) {
        currentNoteID = note?.id
        let hasNote = note != nil
        titleField.isHidden = !hasNote
        contentScrollView.isHidden = !hasNote
        pinButton.isHidden = !hasNote
        deleteButton.isHidden = !hasNote
        emptyLabel.isHidden = hasNote
        guard let note else { return }
        titleField.stringValue = note.title
        contentTextView.string = note.content
        updatePinButtonAppearance(isPinned: note.isPinned)
    }

    // MARK: - Properties

    private var currentNoteID: UUID?

    private lazy var titleField: NSTextField = {
        let field = NSTextField()
        field.placeholderString = "Note title"
        field.isBezeled = false
        field.drawsBackground = false
        field.focusRingType = .none
        field.delegate = self
        field.translatesAutoresizingMaskIntoConstraints = false
        field.observeTheme { field, palette in
            field.font = palette.font(.heading)
            field.textColor = palette.primaryTextColor
            if let placeholder = field.placeholderString {
                field.placeholderAttributedString = NSAttributedString(string: placeholder, attributes: [
                    .foregroundColor: palette.placeholderTextColor,
                    .font: palette.font(.heading)
                ])
            }
        }
        return field
    }()

    private lazy var contentScrollView: NSScrollView = {
        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.observeTheme { view, palette in
            view.backgroundColor = palette.controlBackgroundColor
        }
        return scroll
    }()

    private lazy var contentTextView: NSTextView = {
        let textView = NSTextView()
        textView.isEditable = true
        textView.isSelectable = true
        textView.isRichText = false
        textView.textContainerInset = NSSize(width: 8, height: 8)
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.allowsUndo = true
        textView.delegate = self
        textView.textContainer?.widthTracksTextView = true
        textView.autoresizingMask = [.width]
        textView.observeTheme { view, palette in
            view.font = palette.font(.body)
            view.textColor = palette.primaryTextColor
            view.backgroundColor = palette.controlBackgroundColor
            view.insertionPointColor = palette.cursorColor
            view.selectedTextAttributes = [
                .backgroundColor: palette.selectionColor,
                .foregroundColor: palette.selectionTextColor
            ]
        }
        return textView
    }()

    private lazy var pinButton: NSButton = {
        let btn = NSButton()
        btn.isBordered = false
        btn.image = NSImage(systemSymbolName: "pin", accessibilityDescription: "Pin")
        btn.image?.isTemplate = true
        btn.toolTip = "Pin note"
        btn.target = self
        btn.action = #selector(pinTapped)
        btn.translatesAutoresizingMaskIntoConstraints = false
        return btn
    }()

    private lazy var deleteButton: NSButton = {
        let btn = NSButton()
        btn.isBordered = false
        btn.image = NSImage(systemSymbolName: "trash", accessibilityDescription: "Delete")
        btn.image?.isTemplate = true
        btn.toolTip = "Delete note"
        btn.target = self
        btn.action = #selector(deleteTapped)
        btn.translatesAutoresizingMaskIntoConstraints = false
        return btn
    }()

    private lazy var emptyLabel: NSTextField = {
        let label = ThemedLabel(string: "Select or create a note", role: .secondaryText, textRole: .body)
        label.alignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    // MARK: - View Lifecycle

    override public func loadView() {
        // The editor is the split view's main content pane, so it sits directly
        // on the window backdrop rather than a `surface` plane.
        view = ThemedBackgroundView(role: .windowBackground)
        view.translatesAutoresizingMaskIntoConstraints = false
    }

    override public func viewDidLoad() {
        super.viewDidLoad()

        contentScrollView.documentView = contentTextView
        view.addSubview(pinButton)
        view.addSubview(deleteButton)
        view.addSubview(titleField)
        view.addSubview(contentScrollView)
        view.addSubview(emptyLabel)

        NSLayoutConstraint.activate([
            pinButton.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
            pinButton.trailingAnchor.constraint(equalTo: deleteButton.leadingAnchor, constant: -8),
            pinButton.widthAnchor.constraint(equalToConstant: 24),
            pinButton.heightAnchor.constraint(equalToConstant: 24),

            deleteButton.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
            deleteButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            deleteButton.widthAnchor.constraint(equalToConstant: 24),
            deleteButton.heightAnchor.constraint(equalToConstant: 24),

            titleField.topAnchor.constraint(equalTo: pinButton.bottomAnchor, constant: 8),
            titleField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            titleField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

            contentScrollView.topAnchor.constraint(equalTo: titleField.bottomAnchor, constant: 8),
            contentScrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            contentScrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            contentScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            emptyLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])

        show(note: nil)
    }

    // MARK: - Actions

    @objc private func pinTapped() {
        guard let id = currentNoteID else { return }
        delegate?.noteEditorDidRequestPin(for: id)
    }

    @objc private func deleteTapped() {
        guard let id = currentNoteID else { return }
        let alert = NSAlert()
        alert.messageText = "Delete Note"
        alert.informativeText = "Are you sure you want to delete this note? This cannot be undone."
        alert.addButton(withTitle: "Delete")
        alert.addButton(withTitle: "Cancel")
        alert.alertStyle = .warning
        guard let window = view.window else { return }
        alert.beginSheetModal(for: window) { [weak self] response in
            if response == .alertFirstButtonReturn {
                self?.delegate?.noteEditorDidRequestDelete(for: id)
            }
        }
    }

    // MARK: - Helpers

    private func updatePinButtonAppearance(isPinned: Bool) {
        let symbolName = isPinned ? "pin.fill" : "pin"
        pinButton.image = NSImage(systemSymbolName: symbolName, accessibilityDescription: isPinned ? "Unpin" : "Pin")
        pinButton.image?.isTemplate = true
        pinButton.toolTip = isPinned ? "Unpin note" : "Pin note"
    }
}

// MARK: - NSTextFieldDelegate

extension NoteEditorViewController: NSTextFieldDelegate {
    public func controlTextDidChange(_ obj: Notification) {
        guard let id = currentNoteID else { return }
        delegate?.noteEditorDidChangeTitle(titleField.stringValue, for: id)
    }
}

// MARK: - NSTextViewDelegate

extension NoteEditorViewController: NSTextViewDelegate {
    public func textDidChange(_ notification: Notification) {
        guard let id = currentNoteID else { return }
        delegate?.noteEditorDidChangeContent(contentTextView.string, for: id)
    }
}
