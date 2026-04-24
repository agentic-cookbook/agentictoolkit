import AppKit

public final class NotesSplitViewController: NSSplitViewController {

    // MARK: - Dependencies

    private let notesManager: NotesManager

    // MARK: - Child VCs

    private let listVC = NotesListViewController()
    private let editorVC = NoteEditorViewController()

    // MARK: - Initialization

    public init(notesManager: NotesManager) {
        self.notesManager = notesManager
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    // MARK: - Lifecycle

    override public func viewDidLoad() {
        super.viewDidLoad()

        splitView.isVertical = true
        splitView.dividerStyle = .thin

        let listItem = NSSplitViewItem(viewController: listVC)
        listItem.minimumThickness = 180
        listItem.maximumThickness = 320

        let editorItem = NSSplitViewItem(viewController: editorVC)
        editorItem.minimumThickness = 300

        addSplitViewItem(listItem)
        addSplitViewItem(editorItem)

        listVC.delegate = self
        editorVC.delegate = self
    }

    override public func viewWillAppear() {
        super.viewWillAppear()
        if splitView.subviews.count == 2 {
            splitView.setPosition(240, ofDividerAt: 0)
        }
        reload()
    }

    // MARK: - Reload

    public func reload() {
        listVC.reload(notes: notesManager.notes, keepingSelectedID: listVC.selectedNoteID)
        if let id = listVC.selectedNoteID,
           let note = notesManager.notes.first(where: { $0.id == id }) {
            editorVC.show(note: note)
        }
    }
}

// MARK: - NotesListViewControllerDelegate

extension NotesSplitViewController: NotesListViewControllerDelegate {

    public func notesListDidSelectNote(_ note: Note?) {
        editorVC.show(note: note)
    }

    public func notesListDidRequestNewNote() {
        Task { @MainActor in
            let newID = await notesManager.createNote(title: "", content: "")
            let newNote = notesManager.notes.first(where: { $0.id == newID })
            listVC.reload(notes: notesManager.notes, keepingSelectedID: newID)
            editorVC.show(note: newNote)
        }
    }
}

// MARK: - NoteEditorViewControllerDelegate

extension NotesSplitViewController: NoteEditorViewControllerDelegate {

    public func noteEditorDidChangeTitle(_ title: String, for noteID: UUID) {
        guard let note = notesManager.notes.first(where: { $0.id == noteID }) else { return }
        Task { @MainActor in
            await notesManager.updateNote(note, title: title, content: note.content)
            listVC.reload(notes: notesManager.notes, keepingSelectedID: noteID)
        }
    }

    public func noteEditorDidChangeContent(_ content: String, for noteID: UUID) {
        guard let note = notesManager.notes.first(where: { $0.id == noteID }) else { return }
        Task { @MainActor in
            await notesManager.updateNote(note, title: note.title, content: content)
            listVC.reload(notes: notesManager.notes, keepingSelectedID: noteID)
        }
    }

    public func noteEditorDidRequestPin(for noteID: UUID) {
        guard let note = notesManager.notes.first(where: { $0.id == noteID }) else { return }
        Task { @MainActor in
            await notesManager.togglePin(note: note)
            listVC.reload(notes: notesManager.notes, keepingSelectedID: noteID)
            if let updated = notesManager.notes.first(where: { $0.id == noteID }) {
                editorVC.show(note: updated)
            }
        }
    }

    public func noteEditorDidRequestDelete(for noteID: UUID) {
        Task { @MainActor in
            await notesManager.deleteNote(id: noteID)
            listVC.reload(notes: notesManager.notes, keepingSelectedID: nil)
            editorVC.show(note: nil)
        }
    }
}
