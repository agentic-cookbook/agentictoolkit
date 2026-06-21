import AppKit
import Combine
import AgenticToolkitCore

/// A view (or other object) that recolors itself from a `SemanticPalette`.
@MainActor
public protocol Themeable: AnyObject {
    func applyTheme(_ palette: SemanticPalette)
}

/// Watches the active theme and invokes a closure with the current
/// `SemanticPalette` — immediately on creation, then on every theme change.
/// Mirrors `UserSettingObserver`: own one per themeable control and the control
/// repaints live. Falls back to Solarized Dark when no `ThemeManager` exists
/// (e.g. previews / unit tests without an app host).
@MainActor
public final class ThemePaletteObserver {

    private var cancellable: AnyCancellable?

    /// The palette currently in effect (or a sensible default).
    public static var currentPalette: SemanticPalette {
        ThemeManager.shared?.currentPalette ?? SemanticPalette(theme: BuiltInThemes.solarizedDark)
    }

    public init(_ apply: @escaping (SemanticPalette) -> Void) {
        apply(Self.currentPalette)
        self.cancellable = NotificationCenter.default
            .publisher(for: ThemeManager.didChangeNotification)
            .map { _ in () }                       // drop the (non-Sendable) Notification
            .receive(on: RunLoop.main)
            .sink { _ in apply(Self.currentPalette) }
    }
}
