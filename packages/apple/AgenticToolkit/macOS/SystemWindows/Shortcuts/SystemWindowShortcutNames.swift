import KeyboardShortcuts

/// The standard keyboard-shortcut scheme for window-context management.
///
/// Defaults use Control+Option (`^⌥`):
/// - `^⌥1`–`^⌥9`: switch to a context by index
/// - `^⌥A`: add the frontmost window to the active context
/// - `^⌥X`: remove the frontmost window from its context
/// - `^⌥N` / `^⌥P`: switch to the next / previous context
/// - `^⌥Space`: toggle the context picker
///
/// The raw values are stable `UserDefaults` storage keys for persisted user
/// customizations — do not rename them.
extension KeyboardShortcuts.Name {

    // MARK: - Context Switching by Index

    static let switchToContext1 = Self("switchToContext1", default: .init(.one, modifiers: [.control, .option]))
    static let switchToContext2 = Self("switchToContext2", default: .init(.two, modifiers: [.control, .option]))
    static let switchToContext3 = Self("switchToContext3", default: .init(.three, modifiers: [.control, .option]))
    static let switchToContext4 = Self("switchToContext4", default: .init(.four, modifiers: [.control, .option]))
    static let switchToContext5 = Self("switchToContext5", default: .init(.five, modifiers: [.control, .option]))
    static let switchToContext6 = Self("switchToContext6", default: .init(.six, modifiers: [.control, .option]))
    static let switchToContext7 = Self("switchToContext7", default: .init(.seven, modifiers: [.control, .option]))
    static let switchToContext8 = Self("switchToContext8", default: .init(.eight, modifiers: [.control, .option]))
    static let switchToContext9 = Self("switchToContext9", default: .init(.nine, modifiers: [.control, .option]))

    // MARK: - Window Actions

    static let addWindow = Self("addWindow", default: .init(.a, modifiers: [.control, .option]))
    static let removeWindow = Self("removeWindow", default: .init(.x, modifiers: [.control, .option]))

    // MARK: - Context Navigation

    static let nextContext = Self("nextContext", default: .init(.n, modifiers: [.control, .option]))
    static let previousContext = Self("previousContext", default: .init(.p, modifiers: [.control, .option]))

    // MARK: - Context Picker

    static let contextPicker = Self("contextPicker", default: .init(.space, modifiers: [.control, .option]))

    // MARK: - Helpers

    /// All context-switching-by-index shortcut names, in order (index 0 = context 1).
    static let contextSwitchByIndex: [KeyboardShortcuts.Name] = [
        .switchToContext1, .switchToContext2, .switchToContext3,
        .switchToContext4, .switchToContext5, .switchToContext6,
        .switchToContext7, .switchToContext8, .switchToContext9
    ]

    /// Every window-context shortcut name.
    static let allWindowContextShortcuts: [KeyboardShortcuts.Name] = contextSwitchByIndex + [
        .addWindow, .removeWindow, .nextContext, .previousContext, .contextPicker
    ]
}
