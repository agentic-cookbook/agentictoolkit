import AppKit
import OSLog
import AgenticToolkitCore

/// Owns the Notes feature stack — the storage-backed `NotesManager` plus the
/// two AppKit window controllers (full editor and quick-note popover) — and
/// hides the wiring AppDelegate used to do directly. Hosts construct one with
/// a `NoteStorage`, kick off `loadNotes()` on launch, and call
/// `flushPendingSaves()` from `applicationWillTerminate`.
@MainActor
public final class NotesCoordinator {

    public let notesManager: NotesManager
    public let notesWindowController: NotesWindowController
    public let quickNoteWindowController: QuickNoteWindowController

    public init(storage: NoteStorage) {
        let manager = NotesManager(storage: storage)
        self.notesManager = manager
        self.notesWindowController = NotesWindowController(notesManager: manager)
        self.quickNoteWindowController = QuickNoteWindowController(onSave: { [weak manager] title, content in
            Task { @MainActor in
                guard let manager else { return }
                if !manager.isLoaded { await manager.loadNotes() }
                _ = await manager.createNote(title: title, content: content)
            }
        })
    }

    /// Load persisted notes — call once during app launch.
    public func loadNotes() async {
        await notesManager.loadNotes()
        Self.logger.info("Notes loaded")
    }

    /// Block until any in-flight debounced saves complete — call from
    /// `applicationWillTerminate(_:)` so quitting doesn't drop edits.
    public func flushPendingSaves() async {
        await notesManager.flushPendingSaves()
    }

    public func showNotesWindow() {
        notesWindowController.showNotes()
    }

    public func showQuickNoteWindow(buttonFrame: NSRect) {
        quickNoteWindowController.showNearStatusItem(buttonFrame: buttonFrame)
    }
}

extension NotesCoordinator: Loggable {
    public static nonisolated let logger = makeLogger()
}
