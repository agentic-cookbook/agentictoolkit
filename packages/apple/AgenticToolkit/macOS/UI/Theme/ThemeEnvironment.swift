import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// SwiftUI's half of the theme binding, mirroring `ThemePaletteObserver` for
/// AppKit: a SwiftUI screen reads `@Environment(\.themePalette)` and re-renders
/// when the active theme changes.
///
/// The AppKit side repaints per control because each control owns its own
/// observer; SwiftUI instead re-evaluates a whole subtree from one published
/// value, so the injection point is the *root* of each hosted screen — see
/// `View.themedRoot()`.

/// Republishes the active `SemanticPalette` as an `ObservableObject` so SwiftUI
/// invalidates the views that read it.
@MainActor
public final class ThemeObservable: ObservableObject {

    @Published public private(set) var palette: SemanticPalette

    private var observer: ThemePaletteObserver?

    public init() {
        self.palette = ThemePaletteObserver.currentPalette
        // Assigns once synchronously during init (harmless — no observers yet),
        // then on every theme change.
        self.observer = ThemePaletteObserver { [weak self] palette in
            self?.palette = palette
        }
    }
}

private struct ThemePaletteKey: EnvironmentKey {
    /// A view read outside any `themedRoot()` — an Xcode preview, a detached
    /// snapshot — still gets a real palette rather than crashing or reading
    /// system colors. `themedRoot()` replaces it with the live one.
    static let defaultValue = SemanticPalette(theme: BuiltInThemes.solarizedDark)
}

extension EnvironmentValues {
    /// The active theme's resolved palette. Read it for colors and fonts instead
    /// of `Color.primary`/`.secondary`, which ignore the theme entirely.
    public var themePalette: SemanticPalette {
        get { self[ThemePaletteKey.self] }
        set { self[ThemePaletteKey.self] = newValue }
    }

    /// `themePalette`'s SwiftUI face — `Color`s and `Font`s rather than
    /// `RGBAColor`/`NSFont`. Derived, not stored, so there is still exactly one
    /// palette in the environment; this only spares every SwiftUI call site the
    /// `.swiftUI` hop on a value it is only ever going to use that way.
    public var theme: SwiftUIPalette {
        themePalette.swiftUI
    }
}

/// Injects the live palette into a subtree and paints the backdrop with it.
public struct ThemedRootModifier: ViewModifier {

    @StateObject private var theme = ThemeObservable()

    private let paintsBackground: Bool

    public init(paintsBackground: Bool) {
        self.paintsBackground = paintsBackground
    }

    public func body(content: Content) -> some View {
        content
            .environment(\.themePalette, theme.palette)
            .foregroundStyle(theme.palette.swiftUI.primaryText)
            .background(paintsBackground ? theme.palette.swiftUI.windowBackground : Color.clear)
    }
}

extension View {
    /// Marks the root of a hosted SwiftUI screen as themed: everything below can
    /// read `@Environment(\.themePalette)`, inherits primary-text color, and (by
    /// default) sits on the theme's window background.
    ///
    /// Apply this once per `NSHostingController`/`NSHostingView` root. Nesting it
    /// is harmless but wasteful — each application owns another observer.
    ///
    /// Pass `paintsBackground: false` for a subtree that deliberately sits on a
    /// surface its parent already painted.
    public func themedRoot(paintsBackground: Bool = true) -> some View {
        modifier(ThemedRootModifier(paintsBackground: paintsBackground))
    }
}
