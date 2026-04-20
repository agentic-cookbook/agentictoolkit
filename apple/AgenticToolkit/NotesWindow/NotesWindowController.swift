import AppKit
import CoreUI
import os

/// Manages the Notes window lifecycle. Hosts a `NotesSplitViewController`
/// with list + editor panes.
@MainActor
public final class NotesWindowController: SingleWindowController {

    private let notesManager: NotesManager
    private let logger: Logger?
    private var splitVC: NotesSplitViewController?

    public init(notesManager: NotesManager, logger: Logger? = nil) {
        self.notesManager = notesManager
        self.logger = logger
        super.init(windowID: "notes")
    }

    public override var windowTitle: String { "Notes" }
    public override var defaultContentRect: NSRect {
        NSRect(x: 0, y: 0, width: 700, height: 500)
    }
    public override var windowStyleMask: NSWindow.StyleMask {
        [.titled, .closable, .miniaturizable, .resizable]
    }
    public override var minSize: NSSize? {
        NSSize(width: 480, height: 300)
    }

    public override func makeContentViewController() -> NSViewController? {
        let svc = NotesSplitViewController(notesManager: notesManager)
        splitVC = svc
        return svc
    }

    /// Shows (or brings forward) the notes window, loading notes if needed.
    public func showNotes() {
        if !notesManager.isLoaded {
            Task { @MainActor in
                await notesManager.loadNotes()
                splitVC?.reload()
            }
        }
        showWindow()
        logger?.debug("Notes window shown")
    }
}
