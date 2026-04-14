import AppKit

/// One-time migration from NSWindow's `setFrameAutosaveName` storage
/// to `WindowManager`'s proportional format.
enum WindowManagerMigration {

    private static let migrationKey = "AgenticToolkitWindowManagerMigrationV1"

    /// Migrates old autosave frame data if not already done.
    /// Call early in `applicationDidFinishLaunching`, before any window creation.
    static func migrateIfNeeded() {
        guard !UserDefaults.standard.bool(forKey: migrationKey) else { return }

        let migrations: [(autosaveName: String, wmIdentifier: String)] = [
            ("AgenticToolkitSessionPanel", "sessionPanel"),
            ("AgenticToolkitSettingsWindow", "settings"),
        ]

        for (autosaveName, wmIdentifier) in migrations {
            let nsKey = "NSWindow Frame \(autosaveName)"
            guard let frameString = UserDefaults.standard.string(forKey: nsKey) else { continue }

            // NSWindow frame string format: "x y w h screenX screenY screenW screenH"
            let parts = frameString.split(separator: " ").compactMap { Double($0) }
            guard parts.count >= 4 else { continue }

            let windowFrame = NSRect(
                x: parts[0], y: parts[1],
                width: parts[2], height: parts[3]
            )

            // Find the screen the window was on (best effort match using the saved screen frame)
            let screen: NSScreen
            if parts.count >= 8 {
                let savedScreenFrame = NSRect(
                    x: parts[4], y: parts[5],
                    width: parts[6], height: parts[7]
                )
                screen = NSScreen.screens.first(where: {
                    abs($0.frame.origin.x - savedScreenFrame.origin.x) < 2
                        && abs($0.frame.origin.y - savedScreenFrame.origin.y) < 2
                        && abs($0.frame.width - savedScreenFrame.width) < 2
                }) ?? NSScreen.main ?? NSScreen.screens[0]
            } else {
                screen = NSScreen.main ?? NSScreen.screens[0]
            }

            let visibleFrame = screen.visibleFrame
            let availW = visibleFrame.width - windowFrame.width
            let availH = visibleFrame.height - windowFrame.height

            let state = PersistedWindowState(
                proportionalX: availW > 0 ? (windowFrame.origin.x - visibleFrame.origin.x) / availW : 0.5,
                proportionalY: availH > 0 ? (windowFrame.origin.y - visibleFrame.origin.y) / availH : 0.5,
                width: windowFrame.width,
                height: windowFrame.height,
                screenFingerprint: ScreenFingerprint.from(screen),
                savedAt: Date()
            )

            let key = "AgenticToolkitWindowState_\(wmIdentifier)"
            if let data = try? JSONEncoder().encode(state) {
                UserDefaults.standard.set(data, forKey: key)
            }

            // Clean up old key
            UserDefaults.standard.removeObject(forKey: nsKey)
            Log.ui.info("WindowManager: migrated '\(autosaveName)' → '\(wmIdentifier)'")
        }

        UserDefaults.standard.set(true, forKey: migrationKey)
    }
}
