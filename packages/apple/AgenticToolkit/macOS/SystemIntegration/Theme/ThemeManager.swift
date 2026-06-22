import AppKit
import OSLog
import AgenticToolkitCore

/// Owns the app-wide active theme. Resolves the selected `ColorTheme` and its
/// `SemanticPalette`, applies the saved selection at launch, and reacts to live
/// changes (from the theme settings panel). Modeled on `AppearanceManager`.
///
/// Themeable controls read `ThemeManager.shared?.currentPalette` and observe
/// `didChangeNotification` to repaint when the theme changes.
@MainActor
public final class ThemeManager: AppFeature {

    /// Posted (object = the manager) whenever the active theme or its definition
    /// changes. Themeable controls observe this to reapply colors live.
    public static let didChangeNotification = Notification.Name("AgenticToolkit.ThemeManager.didChange")

    /// The most recently constructed manager. Held weakly — the
    /// `AppFeatureRegistry` retains the instance for the app's lifetime.
    public private(set) static weak var shared: ThemeManager?

    public let store: ThemeStore

    public private(set) var currentTheme: ColorTheme
    public private(set) var currentPalette: SemanticPalette

    /// When true (the default), the manager sets `NSApplication.shared.appearance` to match the
    /// active theme's light/dark/auto so AppKit's semantic colors contrast
    /// correctly against themed surfaces. Hosts that manage appearance
    /// themselves can opt out.
    public var drivesApplicationAppearance = true

    private var activeObserver: UserSettingObserver<String>?
    private var customObserver: UserSettingObserver<[ColorTheme]>?

    public override init() {
        let store = ThemeStore()
        let theme = store.theme(withID: UserSettings.activeThemeID.value) ?? BuiltInThemes.solarizedDark
        self.store = store
        self.currentTheme = theme
        self.currentPalette = SemanticPalette(theme: theme)
        super.init()

        ThemeManager.shared = self
        applyApplicationAppearance()

        // React to a different theme being selected, or to the active theme's
        // definition being edited in place.
        activeObserver = UserSettingObserver(UserSettings.activeThemeID) { [weak self] _ in
            self?.reload()
        }
        customObserver = UserSettingObserver(UserSettings.customThemes) { [weak self] _ in
            self?.reload()
        }
    }

    private func applyApplicationAppearance() {
        guard drivesApplicationAppearance else { return }
        // Use `NSApplication.shared`, not the `NSApp` implicitly-unwrapped global:
        // `NSApp` stays nil until the host first accesses `NSApplication.shared`,
        // so a host that constructs the manager before app setup (Stenographer
        // builds it in `main.swift` ahead of `NSApplication.shared`) would
        // crash force-unwrapping `NSApp`. `NSApplication.shared` lazily creates
        // the instance and is safe at any point.
        NSApplication.shared.appearance = currentTheme.appearance.nsAppearance
        applyWindowBackgrounds()
    }

    /// Paints every titled app window's backdrop with the theme's window color so
    /// chrome around content (and any view that hasn't opted into theming yet)
    /// follows the theme — broad coverage on top of per-view theming.
    private func applyWindowBackgrounds() {
        let background = NSColor(currentPalette.windowBackground)
        for window in NSApplication.shared.windows where Self.shouldThemeBackground(of: window) {
            window.backgroundColor = background
        }
    }

    /// Whether a window's backdrop should follow the theme. Excludes the shared
    /// system pickers (`NSColorPanel`/`NSFontPanel`), which AppKit owns: the theme
    /// editor opens an `NSColorWell` → `NSColorPanel`, and editing a swatch would
    /// otherwise repaint the system picker's own backdrop with the theme color.
    static func shouldThemeBackground(of window: NSWindow) -> Bool {
        guard window.styleMask.contains(.titled) else { return false }
        if window is NSColorPanel || window is NSFontPanel { return false }
        return true
    }

    /// Selects a theme by ID. Persists the choice and updates the resolved
    /// theme/palette synchronously (the live-update observer also fires for
    /// external changes such as in-place edits to a custom theme).
    public func selectTheme(id: String) {
        UserSettings.activeThemeID.value = id
        reload()
    }

    private func reload() {
        let theme = store.theme(withID: UserSettings.activeThemeID.value) ?? BuiltInThemes.solarizedDark
        // `selectTheme` both sets `activeThemeID` (which fires `activeObserver` →
        // `reload()` on the next runloop tick) and calls `reload()` synchronously,
        // so `reload()` runs twice per selection. Bail when nothing actually
        // changed: the second call is a no-op (no duplicate notification / repaint),
        // while an in-place edit of the active theme still differs and proceeds.
        guard theme != currentTheme else { return }
        currentTheme = theme
        currentPalette = SemanticPalette(theme: theme)
        applyApplicationAppearance()
        logger.info("Active theme: \(theme.name, privacy: .public)")
        NotificationCenter.default.post(name: Self.didChangeNotification, object: self)
    }
}

extension ThemeAppearance {
    /// The matching `NSAppearance` (`nil` follows the system).
    public var nsAppearance: NSAppearance? {
        switch self {
        case .auto: return nil
        case .dark: return NSAppearance(named: .darkAqua)
        case .light: return NSAppearance(named: .aqua)
        }
    }
}

extension ThemeManager: Loggable {
    public static nonisolated let logger = makeLogger()
}
