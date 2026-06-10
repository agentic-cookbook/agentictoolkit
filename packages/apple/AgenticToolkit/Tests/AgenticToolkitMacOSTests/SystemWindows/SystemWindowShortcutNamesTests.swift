import Testing
import KeyboardShortcuts
@testable import AgenticToolkitMacOS

/// Covers the canonical window-context shortcut scheme — the name list, its
/// ordering, and that every shortcut ships a default. These exercise toolkit
/// internals, so they live with the component (rather than in a consumer).
@Suite("SystemWindow shortcut names")
struct SystemWindowShortcutNamesTests {

    @Test("nine context-switch-by-index names")
    func contextSwitchByIndexHasNineEntries() {
        #expect(KeyboardShortcuts.Name.contextSwitchByIndex.count == 9)
    }

    @Test("fourteen shortcuts total: 9 index + 2 window + 2 navigation + 1 picker")
    func allShortcutsCount() {
        #expect(KeyboardShortcuts.Name.allWindowContextShortcuts.count == 14)
    }

    @Test("every shortcut name is unique")
    func namesAreUnique() {
        let names = KeyboardShortcuts.Name.allWindowContextShortcuts.map(\.rawValue)
        #expect(names.count == Set(names).count)
    }

    @Test("context-switch names are ordered 1...9")
    func contextSwitchNamesAreOrdered() {
        let names = KeyboardShortcuts.Name.contextSwitchByIndex.map(\.rawValue)
        #expect(names == [
            "switchToContext1",
            "switchToContext2",
            "switchToContext3",
            "switchToContext4",
            "switchToContext5",
            "switchToContext6",
            "switchToContext7",
            "switchToContext8",
            "switchToContext9"
        ])
    }

    @Test("every shortcut ships a default binding")
    func allShortcutsHaveDefaults() {
        for name in KeyboardShortcuts.Name.allWindowContextShortcuts {
            #expect(name.defaultShortcut != nil, "\(name.rawValue) should have a default shortcut")
        }
    }

    @Test("the context picker shortcut exists, has a default, and is in the full set")
    func contextPickerShortcutIsRegistered() {
        #expect(KeyboardShortcuts.Name.contextPicker.rawValue == "contextPicker")
        #expect(KeyboardShortcuts.Name.contextPicker.defaultShortcut != nil)
        #expect(KeyboardShortcuts.Name.allWindowContextShortcuts.contains(.contextPicker))
    }
}
