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

    @Test("addNewTheme creates an editable custom theme")
    func addNew() {
        let created = store.addNewTheme(name: "Fresh")
        #expect(created.name == "Fresh")
        #expect(created.isEditable)
        #expect(store.customThemes.contains(created))
    }

    @Test("importITermColors stores a locked, deletable import")
    func importITermMarksLocked() throws {
        var dict: [String: Any] = [
            "Foreground Color": ["Red Component": 1.0, "Green Component": 1.0, "Blue Component": 1.0],
            "Background Color": ["Red Component": 0.0, "Green Component": 0.0, "Blue Component": 0.0]
        ]
        for index in 0..<16 {
            dict["Ansi \(index) Color"] = ["Red Component": 0.0, "Green Component": 0.0, "Blue Component": 0.0]
        }
        let data = try PropertyListSerialization.data(fromPropertyList: dict, format: .xml, options: 0)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Locked.itermcolors")
        try data.write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }

        let imported = try store.importITermColors(contentsOf: url)
        #expect(imported.isImported)
        #expect(imported.isLocked)
        #expect(imported.isDeletable)
    }

    @Test("exportJSON → importJSON stores a locked import with a fresh id")
    func jsonRoundTripLocks() throws {
        let source = sampleTheme(name: "Shared")
        let data = try store.exportJSON(source)
        let imported = try store.importJSON(data: data)

        #expect(imported.id != source.id)          // fresh id, never collides
        #expect(imported.name == "Shared")
        #expect(imported.isImported)
        #expect(imported.isLocked)
        #expect(imported.isDeletable)
        #expect(store.theme(withID: imported.id) != nil)
    }

    @Test("importJSON refuses to let a payload masquerade as a built-in")
    func importJSONSanitizesBuiltIn() throws {
        var evil = sampleTheme(name: "Fake Builtin")
        evil.isBuiltIn = true
        let data = try store.exportJSON(evil)
        let imported = try store.importJSON(data: data)
        #expect(imported.isBuiltIn == false)
        #expect(imported.isImported)
        #expect(imported.isDeletable)
    }

    @Test("duplicating an imported theme yields a fully editable custom theme")
    func duplicateOfImportUnlocks() throws {
        let data = try store.exportJSON(sampleTheme(name: "Imp"))
        let imported = try store.importJSON(data: data)
        let copy = store.duplicate(imported)
        #expect(copy.isImported == false)
        #expect(copy.isBuiltIn == false)
        #expect(copy.isEditable)
    }

    @Test("duplicate preserves attribution")
    func duplicateKeepsAttribution() {
        var custom = sampleTheme()
        custom.attribution = "Somebody"
        store.add(custom)
        let copy = store.duplicate(custom)
        #expect(copy.attribution == "Somebody")
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

    // MARK: - Import validation & routing

    private func themeJSON(name: String, ansiCount: Int, foreground: String, background: String) -> Data {
        let ansi = Array(repeating: "\"#000000ff\"", count: ansiCount).joined(separator: ",")
        let json = "{\"id\":\"x\",\"name\":\"\(name)\",\"appearance\":\"dark\",\"isBuiltIn\":false,"
            + "\"foreground\":\"\(foreground)\",\"background\":\"\(background)\",\"cursor\":\"#ffffffff\","
            + "\"selection\":\"#111111ff\",\"ansi\":[\(ansi)]}"
        return Data(json.utf8)
    }

    @Test("importJSON rejects a theme without 16 ANSI colors")
    func importJSONRejectsShortPalette() {
        let data = themeJSON(name: "Broken", ansiCount: 3, foreground: "#ffffffff", background: "#000000ff")
        #expect(throws: ThemeImportError.self) { try store.importJSON(data: data) }
        #expect(store.customThemes.isEmpty)   // nothing persisted on failure
    }

    @Test("importJSON rejects a theme whose foreground equals its background")
    func importJSONRejectsInvisibleText() {
        let data = themeJSON(name: "Invisible", ansiCount: 16, foreground: "#000000ff", background: "#000000ff")
        #expect(throws: ThemeImportError.self) { try store.importJSON(data: data) }
        #expect(store.customThemes.isEmpty)
    }

    @Test("importJSON accepts a well-formed 16-color theme")
    func importJSONAcceptsValid() throws {
        let data = themeJSON(name: "Good", ansiCount: 16, foreground: "#ffffffff", background: "#000000ff")
        let imported = try store.importJSON(data: data)
        #expect(imported.name == "Good")
        #expect(imported.hasValidPalette)
        #expect(imported.isImported)
    }

    @Test("importTheme routes by content, not extension")
    func importThemeSniffsContent() throws {
        // A ColorTheme JSON saved with a .itermcolors extension still imports as JSON.
        let data = try store.exportJSON(sampleTheme(name: "Mislabeled"))
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("Mislabeled-\(UUID().uuidString).itermcolors")
        try data.write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }

        let imported = try store.importTheme(contentsOf: url)
        #expect(imported.name == "Mislabeled")
        #expect(imported.isImported)
    }

    @Test("addNewTheme disambiguates repeated names")
    func addNewUniquifiesNames() {
        let first = store.addNewTheme(name: "New Theme")
        let second = store.addNewTheme(name: "New Theme")
        let third = store.addNewTheme(name: "New Theme")
        #expect(first.name == "New Theme")
        #expect(second.name == "New Theme 2")
        #expect(third.name == "New Theme 3")
    }

    @Test("duplicate disambiguates repeated copies")
    func duplicateUniquifiesNames() {
        let base = store.add(sampleTheme(name: "Base"))
        let first = store.duplicate(base)
        let second = store.duplicate(base)
        #expect(first.name == "Base Copy")
        #expect(second.name == "Base Copy 2")
    }
}
