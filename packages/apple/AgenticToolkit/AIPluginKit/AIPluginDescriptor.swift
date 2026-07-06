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
    public static let currentSchemaVersion = 3

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

    /// Provider presets this plugin advertises. When nil (a v2 descriptor), the
    /// host synthesises one implicit template from the descriptor itself.
    public let templates: [ProviderTemplate]?

    public init(
        schemaVersion: Int = AIPluginDescriptor.currentSchemaVersion,
        identifier: String,
        displayName: String,
        version: String,
        models: [String] = [],
        defaultModel: String? = nil,
        fields: [Field] = [],
        templates: [ProviderTemplate]? = nil
    ) {
        self.schemaVersion = schemaVersion
        self.identifier = identifier
        self.displayName = displayName
        self.version = version
        self.models = models
        self.defaultModel = defaultModel
        self.fields = fields
        self.templates = templates
    }

    /// The model to use when the user has not picked one: the explicit default,
    /// else the first listed model, else an empty string.
    public var resolvedDefaultModel: String {
        defaultModel ?? models.first ?? ""
    }

    /// The templates to present: the explicit list, or one implicit template
    /// derived from this descriptor (so v2 plugins still surface as a provider).
    public var resolvedTemplates: [ProviderTemplate] {
        if let templates, !templates.isEmpty { return templates }
        return [ProviderTemplate(
            id: "default",
            displayName: displayName,
            defaultValues: [:],
            models: models,
            defaultModel: defaultModel,
            secretRequired: true,
            fields: fields
        )]
    }

    /// The fields to render for a template: the template's own override, else the
    /// descriptor's shared fields.
    public func fields(for template: ProviderTemplate) -> [Field] {
        template.fields ?? fields
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

    /// Optional descriptive metadata for one model, shown in the provider picker's
    /// details pane. All fields optional — populated where known.
    public struct ModelDetail: Codable, Sendable, Equatable {
        public let id: String
        /// One-line description of the model.
        public let description: String?
        /// Whether the model supports tool / function calling.
        public let tools: Bool?
        /// What the model is well-suited for.
        public let goodFor: String?

        public init(id: String, description: String? = nil, tools: Bool? = nil, goodFor: String? = nil) {
            self.id = id
            self.description = description
            self.tools = tools
            self.goodFor = goodFor
        }
    }

    /// A named provider preset a plugin advertises: a base URL / auth mode and a
    /// model list the user instantiates as a configuration. Pure data.
    public struct ProviderTemplate: Codable, Sendable, Equatable {
        public let id: String
        public let displayName: String
        /// Seeded config values (e.g. `baseURL`, `authMode`) injected into the
        /// `AIPluginConfig` bag before `buildRequest`.
        public let defaultValues: [String: String]
        public let models: [String]
        public let defaultModel: String?
        /// Whether a secret field must be filled for this provider (false for
        /// keyless local providers like Ollama).
        public let secretRequired: Bool
        /// Field overrides for this template; nil inherits the descriptor's fields.
        public let fields: [Field]?
        /// The vendor/service the provider connects to, e.g. "Anthropic", "Google",
        /// "Groq". Shown as the picker's Provider column. Falls back to `displayName`.
        public let provider: String?
        /// The model brand this provider serves, e.g. "Claude", "Gemini", "GPT".
        /// Shown as the picker's LLM column.
        public let llm: String?
        /// The auth/connection method, e.g. "API Key", "OAuth Account",
        /// "Subscription Token". Shown as the picker's Config Type column. Falls back
        /// to "API Key" / "Local" based on `secretRequired`.
        public let configType: String?
        /// One-line blurb about the vendor, for the details pane.
        public let providerDescription: String?
        /// One-line blurb about the model family, for the details pane.
        public let llmDescription: String?
        /// Per-model descriptive metadata (description / tool support / strengths),
        /// keyed by model id. Models without an entry render as a plain line.
        public let modelDetails: [ModelDetail]?

        public init(
            id: String,
            displayName: String,
            defaultValues: [String: String] = [:],
            models: [String] = [],
            defaultModel: String? = nil,
            secretRequired: Bool = true,
            fields: [Field]? = nil,
            provider: String? = nil,
            llm: String? = nil,
            configType: String? = nil,
            providerDescription: String? = nil,
            llmDescription: String? = nil,
            modelDetails: [ModelDetail]? = nil
        ) {
            self.id = id
            self.displayName = displayName
            self.defaultValues = defaultValues
            self.models = models
            self.defaultModel = defaultModel
            self.secretRequired = secretRequired
            self.fields = fields
            self.provider = provider
            self.llm = llm
            self.configType = configType
            self.providerDescription = providerDescription
            self.llmDescription = llmDescription
            self.modelDetails = modelDetails
        }

        /// The `ModelDetail` for a model id, if the template supplies one.
        public func modelDetail(for modelID: String) -> ModelDetail? {
            modelDetails?.first { $0.id == modelID }
        }

        public var resolvedDefaultModel: String {
            defaultModel ?? models.first ?? ""
        }

        /// Vendor name for the Provider column (falls back to `displayName`).
        public var resolvedProvider: String { provider ?? displayName }

        /// Model brand for the LLM column (empty when unspecified).
        public var resolvedLLM: String { llm ?? "" }

        /// Auth method for the Config Type column (inferred from `secretRequired`
        /// when unspecified).
        public var resolvedConfigType: String {
            configType ?? (secretRequired ? "API Key" : "Local")
        }
    }
}
