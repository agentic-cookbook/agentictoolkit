import AppKit

/// Shared keyboard + Escape wiring for the filter-field-driven pickers (the
/// provider picker and the model picker). Each picker owns its own table, cells,
/// selection model, and chrome; this factors out the one piece that was byte-for-
/// byte identical (and easy to get subtly wrong): the up/down/return/escape
/// dispatch out of the search field, plus the window-level Escape monitor a search
/// field otherwise swallows to clear itself.
///
/// The owner sets the three callbacks and forwards `control(_:textView:doCommandBy:)`
/// to `handle(_:)`; it installs the monitor on appear and tears it down on
/// disappear. That leaves Escape wired exactly once (this monitor), rather than
/// also via a Cancel button's key equivalent and a `cancelOperation(_:)` override.
@MainActor
final class PickerKeyboardController {

    /// Move the selection by a delta (−1 up, +1 down).
    var onMoveSelection: (Int) -> Void = { _ in }
    /// Return / double-click equivalent — commit the highlighted row.
    var onChoose: () -> Void = {}
    /// Escape — cancel / dismiss.
    var onCancel: () -> Void = {}

    private var escapeMonitor: Any?

    /// Install the window-level Escape monitor. Call from `viewDidAppear` (after
    /// making the search field first responder).
    func startEscapeMonitor(for window: NSWindow?) {
        stopEscapeMonitor()
        escapeMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self, weak window] event in
            guard let self, let window, event.window === window, event.keyCode == 53 else { return event }
            self.onCancel()
            return nil
        }
    }

    /// Remove the monitor. Call from `viewWillDisappear`.
    func stopEscapeMonitor() {
        if let escapeMonitor {
            NSEvent.removeMonitor(escapeMonitor)
            self.escapeMonitor = nil
        }
    }

    /// Route a search-field `doCommandBy:` selector; returns true when handled.
    func handle(_ commandSelector: Selector) -> Bool {
        switch commandSelector {
        case #selector(NSResponder.moveDown(_:)): onMoveSelection(1); return true
        case #selector(NSResponder.moveUp(_:)): onMoveSelection(-1); return true
        case #selector(NSResponder.insertNewline(_:)): onChoose(); return true
        case #selector(NSResponder.cancelOperation(_:)): onCancel(); return true
        default: return false
        }
    }
}
