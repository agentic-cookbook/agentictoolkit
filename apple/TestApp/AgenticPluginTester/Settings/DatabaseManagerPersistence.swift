import Foundation
import AgenticUI

/// Bridges `AISettingsPersistence` to the TestApp's `DatabaseManager`.
/// Handles key translation so the library's key names map to the existing DB schema.
final class DatabaseManagerPersistence: AISettingsPersistence {

    private let databaseManager: DatabaseManager

    /// Maps AISettingsViewModel keys to existing DB keys where they differ.
    private static let keyMap: [String: String] = [
        AISettingsViewModel.pluginKey: "ai_provider",
    ]

    /// Old AIProvider raw values → plugin identifiers.
    private static let providerMigration: [String: String] = [
        "claude_cli": "com.agenticplugins.plugin.claude-local",
        "anthropic": "com.agenticplugins.plugin.claude-api",
        "openai": "com.agenticplugins.plugin.openai",
        "google": "com.agenticplugins.plugin.google",
        "custom": "com.agenticplugins.plugin.openai-compatible",
    ]

    init(databaseManager: DatabaseManager) {
        self.databaseManager = databaseManager
    }

    func loadSetting(key: String) -> String? {
        let dbKey = Self.keyMap[key] ?? key
        guard let value = try? databaseManager.getSetting(key: dbKey) else { return nil }

        // Migrate old AIProvider enum values on read
        if key == AISettingsViewModel.pluginKey, let migrated = Self.providerMigration[value] {
            // Write the migrated value back so we only migrate once
            try? databaseManager.setSetting(key: dbKey, value: migrated)
            return migrated
        }

        return value
    }

    func saveSetting(key: String, value: String) {
        let dbKey = Self.keyMap[key] ?? key
        try? databaseManager.setSetting(key: dbKey, value: value)
    }
}
