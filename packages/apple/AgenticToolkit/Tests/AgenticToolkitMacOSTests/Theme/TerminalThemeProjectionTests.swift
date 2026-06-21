import Testing
import Foundation
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@MainActor
@Suite("Terminal theme projection")
struct TerminalThemeProjectionTests {

    @Test("built-in profiles derive from BuiltInThemes")
    func derives() {
        let profiles = TerminalSessionProfile.builtInProfiles()
        #expect(profiles.count == BuiltInThemes.all.count)
        #expect(profiles.map(\.name) == BuiltInThemes.all.map(\.name))
    }

    @Test("projection reproduces the historical hex values")
    func projection() {
        let dracula = BuiltInThemes.dracula.terminalPalette
        #expect(dracula.foreground == "#f8f8f2")
        #expect(dracula.background == "#282a36")
        #expect(dracula.cursor == "#f8f8f2")
        #expect(dracula.selection == "#44475a")
        #expect(dracula.ansi.count == 16)
        #expect(dracula.ansi[5] == "#ff79c6")

        let solarizedLight = BuiltInThemes.solarizedLight.terminalPalette
        #expect(solarizedLight.background == "#fdf6e3")
    }

    @Test("derived built-in profile keeps terminal defaults and is read-only")
    func defaults() throws {
        let dracula = try #require(
            TerminalSessionProfile.builtInProfiles().first { $0.name == "Dracula" }
        )
        #expect(dracula.fontName == "Menlo")
        #expect(dracula.fontSize == 13)
        #expect(dracula.cursorStyle == .block)
        #expect(dracula.isDeletable == false)
        #expect(dracula.id.uuidString == "A1B2C3D4-0003-4000-8000-000000000003")
    }
}
