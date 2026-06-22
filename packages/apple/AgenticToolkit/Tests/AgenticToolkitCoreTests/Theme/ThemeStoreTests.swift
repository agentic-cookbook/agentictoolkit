import Testing
import Foundation
@testable import AgenticToolkitCore

@MainActor
@Suite(.serialized)
struct ThemeStoreTests {

    let store = ThemeStore()

    // Fresh in-memory settings per test — never touches real UserDefaults.
    init() {
        UserSettings.shared = UserSettings(with: InMemorySettingsStorageProvider())
    }

    private func sampleTheme(name: String = "Sample") -> ColorTheme {
        ColorTheme(
            name: name, appearance: .dark,
            foreground: .white, background: .black, cursor: .white, selection: .black,
            ansi: Array(repeating: .black, count: 16)
        )
    }

    @Test("starts with only the built-in themes")
    func startsWithBuiltIns() {
        #expect(store.customThemes.isEmpty)
        #expect(store.allThemes.count == BuiltInThemes.all.count)
    }

    @Test("add appends and persists a custom theme")
    func add() {
        let theme = sampleTheme()
        store.add(theme)

        #expect(store.customThemes.count == 1)
        #expect(store.allThemes.count == BuiltInThemes.all.count + 1)
        #expect(store.theme(withID: theme.id) == theme)
    }

    @Test("isBuiltIn distinguishes built-in from custom themes")
    func builtInDetection() {
        let custom = sampleTheme()
        store.add(custom)
        #expect(store.isBuiltIn(id: BuiltInThemes.defaultID))
        #expect(!store.isBuiltIn(id: custom.id))
    }

    @Test("update replaces a custom theme and ignores built-ins")
    func update() {
        var theme = sampleTheme(name: "Before")
        store.add(theme)
        theme.name = "After"
        store.update(theme)
        #expect(store.theme(withID: theme.id)?.name == "After")

        // Updating a built-in ID is a no-op (built-ins are read-only).
        var builtin = BuiltInThemes.dracula
        builtin.name = "Hacked"
        store.update(builtin)
        #expect(store.theme(withID: BuiltInThemes.dracula.id)?.name == "Dracula")
    }

    @Test("delete removes a custom theme and ignores built-ins")
    func delete() {
        let theme = sampleTheme()
        store.add(theme)
        store.delete(id: theme.id)
        #expect(store.theme(withID: theme.id) == nil)

        store.delete(id: BuiltInThemes.defaultID)
        #expect(store.theme(withID: BuiltInThemes.defaultID) != nil)
    }

    @Test("duplicate creates an editable copy with a new ID")
    func duplicate() {
        let copy = store.duplicate(BuiltInThemes.dracula)
        #expect(copy.id != BuiltInThemes.dracula.id)
        #expect(copy.isBuiltIn == false)
        #expect(copy.name == "Dracula Copy")
        #expect(copy.ansi == BuiltInThemes.dracula.ansi)
        #expect(store.customThemes.contains(copy))
    }

    @Test("importITermColors parses a file and stores it")
    func importITermColors() throws {
        var dict: [String: Any] = [
            "Foreground Color": ["Red Component": 1.0, "Green Component": 1.0, "Blue Component": 1.0],
            "Background Color": ["Red Component": 0.0, "Green Component": 0.0, "Blue Component": 0.0]
        ]
        for index in 0..<16 {
            dict["Ansi \(index) Color"] = ["Red Component": 0.0, "Green Component": 0.0, "Blue Component": 0.0]
        }
        let data = try PropertyListSerialization.data(fromPropertyList: dict, format: .xml, options: 0)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Imported.itermcolors")
        try data.write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }

        let imported = try store.importITermColors(contentsOf: url)
        #expect(imported.name == "Imported")
        #expect(store.theme(withID: imported.id) != nil)
    }

    @Test("duplicate preserves the source theme's typography")
    func duplicatePreservesTypography() {
        var custom = sampleTheme(name: "Typed")
        custom.typography.sizeScale = 1.4
        custom.typography.styles[TextRole.body.rawValue] =
            FontStyle(family: "Menlo", size: 15, weight: .bold)
        store.add(custom)

        let copy = store.duplicate(custom)
        #expect(copy.typography == custom.typography)
        #expect(copy.typography.sizeScale == 1.4)
        #expect(copy.typography.styles[TextRole.body.rawValue]?.family == "Menlo")
    }
}
