//
//  MCPSettings.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/30/26.
//

import Foundation

/// Per-server secret env values, keyed by `MCPServerConfiguration.id.uuidString`.
///
/// Outer key is the server's UUID (as a string so the value is plain `Codable`),
/// inner dictionary maps env-var name (e.g. `"GITHUB_TOKEN"`) to its secret value.
public typealias MCPServerSecrets = [String: [String: String]]

@MainActor
extension UserSettings {

    /// Non-secret server descriptions. Routed to the regular settings provider.
    public static let mcpServerConfigurations = UserSetting<[MCPServerConfiguration]>(
        "mcp.serverConfigurations",
        default: []
    )

    /// Secret env values for configured servers. Routed to the secure provider
    /// (Keychain in production) via `isSecure: true`, so tokens never land in
    /// the regular settings file.
    public static let mcpServerSecrets = UserSetting<MCPServerSecrets>(
        "mcp.serverSecrets",
        default: [:],
        isSecure: true
    )
}
