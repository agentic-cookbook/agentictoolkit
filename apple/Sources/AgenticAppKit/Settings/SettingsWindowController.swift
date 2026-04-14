import AppKit

/// A reusable settings window that hosts an array of ``SettingsPane`` items
/// in a sidebar + detail layout.
///
/// Creates the window lazily on first ``showSettings()`` call. Uses
/// ``SingleWindowController`` for frame persistence via ``WindowManager``.
///
/// Usage:
/// ```swift
/// let controller = SettingsWindowController(
///     windowID: "settings",
///     title: "My App Settings",
///     panes: [GeneralPane(), AppearancePane(), AdvancedPane()]
/// )
/// controller.showSettings()
/// ```
@MainActor
public final class SettingsWindowController {

    // MARK: - Properties

    private let windowID: String
    private let windowTitle: String
    private let contentSize: NSSize
    private let panes: [SettingsPane]
    private var windowController: SingleWindowController?

    // MARK: - Initialization

    /// Creates a settings window controller.
    /// - Parameters:
    ///   - windowID: Identifier for window frame persistence.
    ///   - title: The window title.
    ///   - contentSize: The initial window content size. Defaults to 600x480.
    ///   - panes: The settings panes to display.
    public init(
        windowID: String = "settings",
        title: String = "Settings",
        contentSize: NSSize = NSSize(width: 600, height: 480),
        panes: [SettingsPane]
    ) {
        self.windowID = windowID
        self.windowTitle = title
        self.contentSize = contentSize
        self.panes = panes
    }

    // MARK: - Show / Hide

    /// Shows the settings window, creating it if needed.
    public func showSettings() {
        if let wc = windowController {
            wc.showWindow()
            return
        }

        let wc = SingleWindowController(
            windowID: windowID,
            title: windowTitle,
            contentRect: NSRect(origin: .zero, size: contentSize)
        ) { [panes] in
            SettingsSplitView(panes: panes)
        }

        self.windowController = wc
        wc.showWindow()
    }

    /// Whether the settings window is currently visible.
    public var isVisible: Bool {
        windowController?.isVisible ?? false
    }
}
