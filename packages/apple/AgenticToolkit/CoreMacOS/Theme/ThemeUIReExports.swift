// The AppKit and SwiftUI theme surface — `SemanticPalette.nsColor(_:)`,
// `ThemeTypography`'s font helpers, `ThemePaletteObserver`, `Themeable` and the
// `Themed*` view family — lives in AgenticDeveloperToolkitUI, which ships to
// customers on its own.
//
// Re-exported from *this* tier as well as from AgenticToolkitMacOS, because
// this is the lowest tier that has it: `CoreMacOS/Theme/` already extends the
// palette for SwiftUI, and a consumer that imports AgenticToolkitCoreMacOS for
// those extensions would otherwise have to reach past it to a framework above
// for the AppKit half of the same idea. Dependencies point downward, so the
// re-export belongs at the bottom of the tiers that need it, not only at the
// top.
//
// Mirrors Core/Theme/ThemeReExports.swift, which does the same for the
// Foundation-only theme model, and macOS/SystemIntegration/Theme/
// ThemeUIReExports.swift, which sits next to the `ThemeManager()` convenience
// init. Importing the same module twice through two tiers is what
// `@_exported` is for; it costs a consumer nothing.
@_exported import AgenticDeveloperToolkitUI
