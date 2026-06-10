import Foundation

/// User-facing settings for a window-context manager, persisted by the host via
/// the toolkit's `UserSettings` — kept separate from the window-context *state*
/// (which the context store owns).
///
/// The host supplies the storage key (it is app-specific); these are the
/// app-neutral fields a window-context UI needs to drive its General/Reconcile
/// settings.
public struct SystemWindowContextsSettings: Codable, Equatable, Sendable {
    /// Whether to launch the host app at login.
    public var launchAtLogin: Bool

    /// How to handle unmatched windows on launch.
    public var reconcileBehavior: ReconcileBehavior

    /// App names to hide from the discovery window list.
    public var hiddenApps: [String]

    /// Whether to show the host app in the Dock (regular) vs. menu-bar-only (accessory).
    public var showAppInDock: Bool

    public init(
        launchAtLogin: Bool = false,
        reconcileBehavior: ReconcileBehavior = .prompt,
        hiddenApps: [String] = [],
        showAppInDock: Bool = false
    ) {
        self.launchAtLogin = launchAtLogin
        self.reconcileBehavior = reconcileBehavior
        self.hiddenApps = hiddenApps
        self.showAppInDock = showAppInDock
    }

    /// Lenient decoder: missing fields fall back to defaults, so settings that
    /// gain new fields still decode older persisted values.
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.launchAtLogin = try container.decodeIfPresent(Bool.self, forKey: .launchAtLogin) ?? false
        self.reconcileBehavior = try container
            .decodeIfPresent(ReconcileBehavior.self, forKey: .reconcileBehavior) ?? .prompt
        self.hiddenApps = try container.decodeIfPresent([String].self, forKey: .hiddenApps) ?? []
        self.showAppInDock = try container.decodeIfPresent(Bool.self, forKey: .showAppInDock) ?? false
    }
}

/// How to handle unmatched windows when the app launches with stale window IDs.
public enum ReconcileBehavior: String, Codable, Equatable, Sendable, CaseIterable {
    /// Automatically assign high-confidence matches, prompt for the rest.
    case prompt
    /// Automatically assign all matches above threshold, ignore the rest.
    case auto
    /// Do not attempt re-matching on launch.
    case ignore
}
