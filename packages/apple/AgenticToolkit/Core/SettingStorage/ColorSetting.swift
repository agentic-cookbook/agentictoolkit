import Foundation

/// A `UserSetting` storing an RGBA color (encoded as `"#RRGGBBAA"`).
///
/// `RGBAColor` itself now lives in `AgenticDeveloperToolkit` alongside the rest
/// of the theme model — it is the theme model's colour primitive, and the theme
/// model ships to customers on its own. It reaches this file (and every other
/// call site) through `Core/Theme/ThemeReExports.swift`.
public typealias ColorSetting = UserSetting<RGBAColor>
