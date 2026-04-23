import AgenticToolkitTerminalWindow
import Foundation

/// Host-provided configuration for document-level features.
///
/// Hosts (e.g., Catnip IDE) implement this to customize behavior of document kit
/// without coupling the toolkit to host-specific types. This is the primary
/// extension point for future view and document migrations.
@MainActor
public protocol ProjectHost: AnyObject {
    /// The file extension used by the host's project package (without leading dot).
    ///
    /// Example: Catnip uses `"catnip-proj"`.
    var projectFileExtension: String { get }

    /// The file extension used by the host's workspace package (without leading dot).
    ///
    /// Example: Catnip uses `"catnip-workspace"`.
    var workspaceFileExtension: String { get }

    /// Supplies AI summarization settings on demand.
    ///
    /// The host typically reads from `UserDefaults` and a keychain; the toolkit
    /// avoids those dependencies and asks the host when a summarization request
    /// is about to be issued.
    var summarizationSettings: SummarizationSettingsProviding { get }
}
