import Foundation
import AIPluginKit
import AgenticToolkitCore

/// First-run seeding of a default configuration so the LLM Providers list is not
/// empty out of the box.
///
/// Seeds a local Claude (CLI) provider — which needs no API key, since it
/// authenticates through the Claude Code CLI's own token — matching the daemon's
/// zero-config "Default (Claude CLI)" summariser path. The selection is left
/// empty: that behaves identically at the daemon and avoids pushing a plugin id
/// the daemon might not resolve. The user can select or delete the row freely.
public enum AIProviderDefaults {

    /// The template seeded on first run: the local Claude Code CLI provider.
    static let defaultTemplateId = "claude-local"

    /// Seeds the default configuration once, when the list is empty. No-op after
    /// the first run, and never clobbers user- or migration-created rows.
    @MainActor
    public static func seedIfNeeded(pluginManager: AIPluginManager) {
        guard !UserSettings.aiDefaultConfigSeeded.value else { return }
        defer { UserSettings.aiDefaultConfigSeeded.value = true }

        guard UserSettings.aiProviderConfigurations.value.isEmpty else { return }

        guard let available = pluginManager.availableTemplates.first(where: {
            $0.template.id == defaultTemplateId
        }) else { return }

        let template = available.template
        let config = AIProviderConfiguration(
            name: template.displayName,
            pluginIdentifier: available.pluginIdentifier,
            templateId: template.id
        )
        let fields = pluginManager.descriptor(for: available.pluginIdentifier)?
            .fields(for: template) ?? (template.fields ?? [])
        AIProviderConfigStore.seed(config: config, template: template, fields: fields)
        UserSettings.aiProviderConfigurations.value = [config]
    }
}
