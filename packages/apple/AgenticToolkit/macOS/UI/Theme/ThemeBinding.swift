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

/// The address of this byte is the associated-object key under which a view
/// keeps the observers attached by `observeTheme(_:)`. Never read or written —
/// only its address is used — so the unchecked annotation is sound.
private nonisolated(unsafe) var themeObserversKey: UInt8 = 0

/// Gives every `NSView` the `observeTheme` helper below.
///
/// It is a protocol extension rather than a plain `extension NSView` because the
/// closure takes `Self`: inside a class extension `Self` is only the covariant
/// return position, so `[weak self]` there is typed `NSView?` and will not
/// satisfy the parameter. In a protocol extension `Self` is the concrete
/// conforming class, and the capture types correctly.
@MainActor
public protocol ThemeObserving: NSObject {}

extension NSView: ThemeObserving {}

extension ThemeObserving where Self: NSView {

    /// Repaint this view on every theme change, for views that have no themed
    /// subclass — a wrapping label, an `NSTextView`, a stock control whose one
    /// themed property is a tint.
    ///
    /// The view owns the observer (stored as an associated object), so it lives
    /// exactly as long as the view does. The closure is handed the view rather
    /// than capturing it, which is what keeps this from building the
    /// view → observer → closure → view cycle the obvious version would.
    ///
    /// Prefer a `Themed*` class where one fits; reach for this when none does.
    public func observeTheme(_ apply: @escaping @MainActor (Self, SemanticPalette) -> Void) {
        let observer = ThemePaletteObserver { [weak self] palette in
            guard let self else { return }
            apply(self, palette)
        }
        var observers = objc_getAssociatedObject(self, &themeObserversKey) as? [ThemePaletteObserver] ?? []
        observers.append(observer)
        objc_setAssociatedObject(self, &themeObserversKey, observers, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
    }
}
