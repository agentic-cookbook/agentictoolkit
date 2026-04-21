// Umbrella target that transitively builds every AgenticToolkit module.
// Consumers should import the specific modules they need, e.g.
//   import AgenticToolkitCore
//   import AgenticToolkitCoreUI
//
// Linking the AgenticToolkitAll product is a convenience for consumers
// (or CI) that want all modules available without listing each one.

@_exported import AgenticToolkitCore
@_exported import AgenticToolkitScripting
@_exported import AgenticToolkitCoreUI
@_exported import AgenticToolkitAIProvider
@_exported import AgenticToolkitChatWindow
@_exported import AgenticToolkitLoggingWindow
@_exported import AgenticToolkitNotesWindow
@_exported import AgenticToolkitSettingsWindow
@_exported import AgenticToolkitTerminalWindow
@_exported import AgenticToolkitFileBrowser
@_exported import AgenticToolkitAIPlugins
