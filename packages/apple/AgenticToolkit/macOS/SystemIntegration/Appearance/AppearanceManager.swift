import AppKit
import OSLog
import AgenticToolkitCore

/// Owns observation and side-effects for the app-wide appearance settings
/// (`UserSettings.appearanceMode`, `UserSettings.textSize`). Construct one
/// per host — usually owned by the AppDelegate. Applies the current stored
/// values on init so launch state matches the saved settings, then reacts
/// to any live changes (e.g. from the settings panel).
@MainActor
public final class AppearanceManager: AppFeature {

    /// When true (the default), the manager writes `NSApp.appearance` from
    /// `UserSettings.appearanceMode`. A host that also runs a `ThemeManager`
    /// must set this to false: the theme's own light/dark is what makes AppKit's
    /// unthemed chrome contrast correctly against themed surfaces, so two
    /// writers would race and the loser's colors would look wrong. `ThemeManager`
    /// reads `appearanceMode` itself, so the setting keeps working either way.
    public var drivesApplicationAppearance = true {
        didSet {
            guard drivesApplicationAppearance, drivesApplicationAppearance != oldValue else { return }
            applyAppearance(UserSettings.appearanceMode.currentValue)
        }
    }

    private var modeObserver: UserSettingObserver<AppearanceMode>?
    private var textSizeObserver: UserSettingObserver<TextSize>?

    public override init() {
        super.init()

        modeObserver = UserSettingObserver(UserSettings.appearanceMode) { [weak self] mode in
            self?.applyAppearance(mode)
        }
        textSizeObserver = UserSettingObserver(UserSettings.textSize) { [weak self] size in
            self?.applyTextSize(size)
        }

        applyAppearance(UserSettings.appearanceMode.currentValue)
        applyTextSize(UserSettings.textSize.currentValue)
    }

    private func applyAppearance(_ mode: AppearanceMode) {
        guard drivesApplicationAppearance else {
            // A `ThemeManager` is writing `NSApp.appearance` instead — but an
            // `.auto` theme resolves through this very setting, so it has to be
            // told the mode moved. Nothing else would: the palette did not
            // change, so no themed view has anything new to draw.
            ThemeManager.shared?.refreshApplicationAppearance()
            return
        }
        NSApp.appearance = mode.nsAppearance
        Self.logger.info("Appearance mode: \(mode.rawValue, privacy: .public)")
    }

    private func applyTextSize(_ size: TextSize) {
        // No host-side consumer yet — observed and logged so the wiring is in
        // place for the day a font scaler wants to react. Future: post a
        // Notification or expose a publisher.
        Self.logger.info("Text size: \(size.rawValue, privacy: .public)")
    }
}

extension AppearanceManager: Loggable {
    public static nonisolated let logger = makeLogger()
}
