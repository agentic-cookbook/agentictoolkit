import AppKit

/// A settings window controller that hosts a `SettingsView`.
///
/// Implemented as a thin specialization over `SingleWindowController` — the
/// window lifecycle and frame persistence come from the shared base; this
/// wrapper narrows the content-view type and keeps a typed reference to the
/// settings view for callers that need programmatic tab selection.
@MainActor
public final class SettingsWindowController {

    private let inner: SingleWindowController

    /// Captures the settings view when the inner controller instantiates it.
    /// Reference type so the view-builder closure can mutate it post-init.
    private final class Box { var value: SettingsView? }
    private let viewBox = Box()

    /// The hosted settings view, available once `showSettings()` has been called at least once.
    public var settingsView: SettingsView? { viewBox.value }

    /// Whether the settings window is currently visible.
    public var isVisible: Bool { inner.isVisible }

    /// Creates a settings window controller.
    ///
    /// - Parameters:
    ///   - title: The window title.
    ///   - size: The initial window size. Defaults to 600x480.
    ///   - windowID: An identifier used for frame persistence via `WindowManager`. Defaults to `"settings"`.
    ///   - viewBuilder: A closure that creates the `SettingsView` on first show.
    public init(
        title: String,
        size: NSSize = NSSize(width: 600, height: 480),
        windowID: String = "settings",
        viewBuilder: @escaping () -> SettingsView
    ) {
        let box = viewBox
        self.inner = SingleWindowController(
            windowID: windowID,
            title: title,
            contentRect: NSRect(origin: .zero, size: size)
        ) {
            let sv = viewBuilder()
            box.value = sv
            return sv
        }
    }

    /// Shows the settings window. Creates it lazily on first call.
    public func showSettings() { inner.showWindow() }
}
