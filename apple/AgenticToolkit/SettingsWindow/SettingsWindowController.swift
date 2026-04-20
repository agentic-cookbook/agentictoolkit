import AppKit
import CoreUI

/// A settings window controller that hosts a `SettingsView`.
///
/// Thin `SingleWindowController` subclass — window lifecycle and frame
/// persistence come from the base; this class narrows the content-view
/// type and exposes a typed reference to the hosted `SettingsView` for
/// callers that need programmatic panel selection.
@MainActor
public final class SettingsWindowController: SingleWindowController {

    private let titleText: String
    private let contentRect: NSRect
    private let viewBuilder: () -> SettingsView

    /// The hosted settings view, available once `showSettings()` has been
    /// called at least once.
    public private(set) var settingsView: SettingsView?

    /// - Parameters:
    ///   - title: The window title.
    ///   - size: Initial window size. Defaults to 600x480.
    ///   - windowID: Identifier used for `WindowManager` frame persistence.
    ///   - viewBuilder: Creates the `SettingsView` on first show.
    public init(
        title: String,
        size: NSSize = NSSize(width: 600, height: 480),
        windowID: String = "settings",
        viewBuilder: @escaping () -> SettingsView
    ) {
        self.titleText = title
        self.contentRect = NSRect(origin: .zero, size: size)
        self.viewBuilder = viewBuilder
        super.init(windowID: windowID)
    }

    public override var windowTitle: String { titleText }
    public override var defaultContentRect: NSRect { contentRect }

    public override func makeContentView() -> NSView? {
        let view = viewBuilder()
        settingsView = view
        return view
    }

    /// Shows the settings window. Creates it lazily on first call.
    public func showSettings() { showWindow() }
}
