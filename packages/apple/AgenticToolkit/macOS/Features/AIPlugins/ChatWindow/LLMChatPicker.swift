import AppKit
import AIPluginKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Presents ``LLMChatViewController`` as an app-modal, **resizable** window centered
/// over a parent and reports the provider + model the user settled on — "try a few
/// and hand me the one that worked". A titled resizable window is used (not a
/// sheet) because sheets don't accept user resizing, the same reason
/// ``ProviderPicker`` and ``ModelChooser`` use one.
@MainActor
public enum LLMChatPicker {

    /// - Parameters:
    ///   - configuration: the provider to open on, or `nil` for the first configured
    ///     one.
    ///   - model: the model to open on, or `nil` for the provider's stored one.
    ///   - onChoose: called with the selection when the user chooses; not called on
    ///     cancel.
    public static func present(
        over parent: NSWindow,
        pluginManager: AIPluginManager,
        configuration: AIProviderConfiguration? = nil,
        model: String? = nil,
        onChoose: @escaping (LLMChatViewController.Selection) -> Void
    ) {
        let controller = LLMChatViewController(
            pluginManager: pluginManager, configuration: configuration,
            model: model, showsChoiceButtons: true)
        let window = NSWindow(contentViewController: controller)
        window.styleMask = [.titled, .closable, .resizable]
        window.title = "Choose an LLM"
        // Force a STANDARD dark/light appearance (matched to the theme's background)
        // so standard AppKit controls render with proper contrast — a custom theme
        // appearance draws the non-default Cancel button's bezel invisibly.
        let background = ThemePaletteObserver.currentPalette.windowBackgroundColor
        let isDark = (background.usingColorSpace(.sRGB)?.brightnessComponent ?? 0.5) < 0.5
        window.appearance = NSAppearance(named: isDark ? .darkAqua : .aqua)
        window.contentMinSize = NSSize(width: 420, height: 420)
        window.contentMaxSize = NSSize(width: 4000, height: 4000)
        window.setContentSize(controller.initialContentSize)

        // Restore the user's saved size + location via the shared frame manager, like
        // every other window. First time, center over the parent.
        if !WindowManager.shared.frames.restoreFrame(
            for: window, id: LLMChatViewController.pickerWindowID) {
            let size = window.frame.size
            window.setFrameOrigin(NSPoint(
                x: parent.frame.midX - size.width / 2,
                y: parent.frame.midY - size.height / 2))
        }

        // Attached only AFTER the programmatic setContentSize + restore: the delegate
        // persists windowDidResize/Move, so attaching it earlier would let the
        // setContentSize above clobber the user's saved frame before restoreFrame
        // reads it.
        window.delegate = controller

        var chosen: LLMChatViewController.Selection?
        controller.completion = { [weak window] result in
            chosen = result
            window?.orderOut(nil)
            NSApp.stopModal()
        }
        NSApp.runModal(for: window)
        if let chosen { onChoose(chosen) }
    }
}
