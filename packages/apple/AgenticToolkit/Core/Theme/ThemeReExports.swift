// The theme model now lives in AgenticDeveloperToolkit, which ships to
// customers on its own. Re-exported here so every existing call site —
// Olylo's log window and timeline, Stenographer, the settings panels —
// keeps resolving `SemanticPalette` through AgenticToolkitCore.
@_exported import AgenticDeveloperToolkit
