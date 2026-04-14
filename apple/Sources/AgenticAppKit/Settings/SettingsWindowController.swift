import AppKit

/// A reusable settings window controller that hosts a `SettingsView`.
///
/// Generic over any `SettingsTopic` type. The app provides a closure that builds
/// the `SettingsView` when the window is first shown.
@MainActor
public final class SettingsWindowController<Topic: SettingsTopic>: NSObject, NSWindowDelegate {

    // MARK: - Properties

    private var window: NSWindow?
    private(set) public var settingsView: SettingsView<Topic>?

    private let windowTitle: String
    private let windowSize: NSSize
    private let windowID: String
    private let viewBuilder: () -> SettingsView<Topic>

    // MARK: - Initialization

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
        viewBuilder: @escaping () -> SettingsView<Topic>
    ) {
        self.windowTitle = title
        self.windowSize = size
        self.windowID = windowID
        self.viewBuilder = viewBuilder
    }

    // MARK: - Show / Hide

    /// Shows the settings window. Creates it lazily on first call.
    public func showSettings() {
        if let window = window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let settingsWindow = NSWindow(
            contentRect: NSRect(origin: .zero, size: windowSize),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        settingsWindow.title = windowTitle
        settingsWindow.isReleasedWhenClosed = false
        settingsWindow.delegate = self

        let sv = viewBuilder()
        self.settingsView = sv
        sv.translatesAutoresizingMaskIntoConstraints = false
        let container = settingsWindow.contentView!
        container.addSubview(sv)
        NSLayoutConstraint.activate([
            sv.topAnchor.constraint(equalTo: container.topAnchor),
            sv.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            sv.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            sv.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        WindowManager.shared.restoreFrame(for: settingsWindow, id: windowID)

        self.window = settingsWindow
        settingsWindow.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    /// Whether the settings window is currently visible.
    public var isVisible: Bool {
        window?.isVisible ?? false
    }

    // MARK: - NSWindowDelegate

    public func windowDidMove(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.saveFrame(for: window, id: windowID)
    }

    public func windowDidResize(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.saveFrame(for: window, id: windowID)
    }
}
