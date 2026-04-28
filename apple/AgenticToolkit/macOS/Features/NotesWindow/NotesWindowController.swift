import AppKit
import os
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// Manages the Notes window lifecycle. Hosts a `NotesSplitViewController`
/// with list + editor panes.
@MainActor
public final class NotesWindowController: SingleWindowController {

    private let notesManager: NotesManager
    private var splitVC: NotesSplitViewController?

    public init(notesManager: NotesManager) {
        self.notesManager = notesManager
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
        logger.debug("Notes window shown")
    }
}

extension NotesWindowController: Loggable {
    public static nonisolated let logger = makeLogger()
}
