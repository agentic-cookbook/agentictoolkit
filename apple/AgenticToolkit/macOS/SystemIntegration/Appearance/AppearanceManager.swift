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
