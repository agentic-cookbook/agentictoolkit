import AppKit
import Combine

import AgenticToolkitCore

/// Whether the user is rearranging panes rather than working in them, tracked
/// per window.
///
/// Per window for the same reason the active pane is: two document windows are
/// two independent workspaces, and turning arrange mode on in one must not put
/// a scrim over the other. Modelled exactly like `ComposableTabsActivePane` so
/// there is one shape to learn for "per-window UI state" rather than two.
@MainActor
public final class ComposableTabsArrangeMode {

    public static let shared = ComposableTabsArrangeMode()

    /// Posted with the affected `NSWindow` as the object.
    public static let didChangeNotification =
        Notification.Name("AgenticToolkit.ComposableTabsArrangeMode.didChange")

    private var enabledWindows: Set<ObjectIdentifier> = []
    private var cancellables = Set<AnyCancellable>()

    private init() {
        // Otherwise the set keeps one dead key per closed document window, and
        // a recycled address would open its successor already in arrange mode.
        NotificationCenter.default.publisher(for: NSWindow.willCloseNotification)
            .compactMap { $0.object as? NSWindow }
            .receive(on: RunLoop.main)
            .sink { [weak self] window in
                self?.enabledWindows.remove(ObjectIdentifier(window))
            }
            .store(in: &cancellables)
    }

    public func isEnabled(in window: NSWindow?) -> Bool {
        guard let window else { return false }
        return enabledWindows.contains(ObjectIdentifier(window))
    }

    public func setEnabled(_ enabled: Bool, in window: NSWindow) {
        let key = ObjectIdentifier(window)
        guard enabledWindows.contains(key) != enabled else { return }
        if enabled {
            enabledWindows.insert(key)
        } else {
            enabledWindows.remove(key)
        }
        NotificationCenter.default.post(name: Self.didChangeNotification, object: window)
    }

    @discardableResult
    public func toggle(in window: NSWindow) -> Bool {
        let enabled = !isEnabled(in: window)
        setEnabled(enabled, in: window)
        return enabled
    }
}
