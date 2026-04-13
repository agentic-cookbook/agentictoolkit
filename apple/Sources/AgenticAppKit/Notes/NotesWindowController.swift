import AppKit
import os

/// Manages the Notes window lifecycle using SingleWindowController.
/// Hosts a NotesSplitViewController with list + editor panes.
@MainActor
public final class NotesWindowController {

    private let notesManager: NotesManager
    private var splitVC: NotesSplitViewController?
    private var windowController: SingleWindowController?
    private let logger: Logger?

    public init(notesManager: NotesManager, logger: Logger? = nil) {
        self.notesManager = notesManager
        self.logger = logger
    }

    /// Shows (or brings forward) the notes window, loading notes if needed.
    public func showNotes() {
        if !notesManager.isLoaded {
            Task { @MainActor in
                await notesManager.loadNotes()
                splitVC?.reload()
            }
        }

        if let wc = windowController {
            wc.showWindow()
            return
        }

        let svc = NotesSplitViewController(notesManager: notesManager)
        self.splitVC = svc

        let wc = SingleWindowController(
            windowID: "notes",
            title: "Notes",
            contentRect: NSRect(x: 0, y: 0, width: 700, height: 500),
            styleMask: [.titled, .closable, .miniaturizable, .resizable]
        ) {
            svc.view
        }

        self.windowController = wc
        wc.showWindow()
        wc.window?.contentViewController = svc
        wc.window?.minSize = NSSize(width: 480, height: 300)
        logger?.debug("Notes window shown")
    }

    public var isVisible: Bool {
        windowController?.isVisible ?? false
    }
}
