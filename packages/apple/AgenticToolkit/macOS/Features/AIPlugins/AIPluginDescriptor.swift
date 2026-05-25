import Foundation

/// The host-side model of a plugin's `descriptor.json` — its identity, the models
/// it offers, and the settings fields the host should render and persist.
///
/// A plugin ships this as a plain JSON resource inside its `.aiplugin` bundle. The
/// host reads it at *discovery* time, without loading the plugin's binary, so it
/// can list and configure a provider before (or without ever) instantiating it.
/// All presentation and configuration metadata lives here as data; the plugin's
/// compiled `AIPlugin` contributes only request-building and response-decoding.
public struct AIPluginDescriptor: Codable, Sendable, Equatable {

    /// The descriptor schema the host understands. Bundles whose
    /// `schemaVersion` differs are skipped at discovery, which is how old
    /// v1 plugins (no `descriptor.json`) are cleanly ignored.
    public static let currentSchemaVersion = 2

    public let schemaVersion: Int
    public let identifier: String
    public let displayName: String
    public let version: String

    /// Model identifiers the user may choose from, rendered as a popup.
    public let models: [String]

    /// The model selected when none has been chosen yet. Falls back to the
    /// first entry in `models` when nil.
    public let defaultModel: String?

    /// Settings the host renders as a form and persists per plugin.
    public let fields: [Field]

    public init(
        schemaVersion: Int = AIPluginDescriptor.currentSchemaVersion,
        identifier: String,
        displayName: String,
        version: String,
        models: [String] = [],
        defaultModel: String? = nil,
        fields: [Field] = []
    ) {
        self.schemaVersion = schemaVersion
        self.identifier = identifier
        self.displayName = displayName
        self.version = version
        self.models = models
        self.defaultModel = defaultModel
        self.fields = fields
    }

    /// The model to use when the user has not picked one: the explicit default,
    /// else the first listed model, else an empty string.
    public var resolvedDefaultModel: String {
        defaultModel ?? models.first ?? ""
    }

    /// One configurable value: a credential, a base URL, etc. The `kind`
    /// decides which control the host renders and whether the value is stored
    /// in the Keychain.
    public struct Field: Codable, Sendable, Equatable {

        public enum Kind: String, Codable, Sendable {
            /// Masked entry, persisted to the Keychain (API keys, tokens).
            case secret
            /// Plain text entry, persisted to user defaults (base URLs, etc.).
            case text
        }

        /// The config key the plugin reads from `AIPluginConfig` (e.g. `apiKey`,
        /// `baseURL`). Also the suffix of the persisted setting key.
        public let key: String
        public let label: String
        public let kind: Kind
        public let placeholder: String?

        public init(key: String, label: String, kind: Kind, placeholder: String? = nil) {
            self.key = key
            self.label = label
            self.kind = kind
            self.placeholder = placeholder
        }

        public var isSecret: Bool { kind == .secret }
    }
}
