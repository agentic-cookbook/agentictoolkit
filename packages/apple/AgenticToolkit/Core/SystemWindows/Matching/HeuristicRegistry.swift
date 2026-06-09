import Foundation

/// Maps application names to their title-parsing heuristics.
///
/// The registry holds all built-in heuristics and provides lookup by
/// app name. When fingerprinting a window, the registry is consulted
/// to find the appropriate heuristic for the owning application.
///
/// Custom user-defined heuristic rules can be loaded from disk and
/// registered alongside the built-in ones. Custom rules override
/// built-in heuristics if they target the same app name.
public final class HeuristicRegistry: @unchecked Sendable {

    /// The shared default registry, pre-populated with all built-in heuristics.
    public static let shared = HeuristicRegistry()

    /// The built-in heuristics that ship with the toolkit. These cannot be deleted.
    public static let builtInHeuristics: [AppHeuristic] = [
        XcodeHeuristic(),
        WarpHeuristic(),
        BraveHeuristic(),
        VSCodeHeuristic(),
        TerminalHeuristic()
    ]

    /// All registered heuristics, in registration order. Mutated only under `lock`.
    private var _heuristics: [AppHeuristic]

    /// Thread-safe snapshot of the registered heuristics, in registration order.
    public var heuristics: [AppHeuristic] {
        lock.lock()
        defer { lock.unlock() }
        return _heuristics
    }

    /// Lookup table: lowercased app name -> heuristic.
    private var appNameMap: [String: AppHeuristic]

    /// The custom heuristic rules currently registered. Mutated only under `lock`.
    private var _customRules: [CustomHeuristicRule] = []

    /// Thread-safe snapshot of the registered custom rules.
    public var customRules: [CustomHeuristicRule] {
        lock.lock()
        defer { lock.unlock() }
        return _customRules
    }

    /// Guards all mutable state. The registry is a shared singleton read during
    /// matching and written when custom rules change, so access is serialized.
    private let lock = NSLock()

    /// Creates a registry with the given heuristics.
    ///
    /// By default, all built-in heuristics are registered.
    public init(heuristics: [AppHeuristic]? = nil) {
        let toRegister = heuristics ?? Self.builtInHeuristics
        self._heuristics = toRegister
        self.appNameMap = [:]

        for heuristic in toRegister {
            for appName in heuristic.appNames {
                appNameMap[appName.lowercased()] = heuristic
            }
        }
    }

    /// Returns the heuristic for the given app name, if one is registered.
    ///
    /// The lookup is case-insensitive.
    ///
    /// - Parameter appName: The application name (e.g., "Xcode", "Brave Browser").
    /// - Returns: The matching heuristic, or nil if no heuristic is registered.
    public func heuristic(for appName: String) -> AppHeuristic? {
        lock.lock()
        defer { lock.unlock() }
        return appNameMap[appName.lowercased()]
    }

    /// Registers an additional heuristic.
    ///
    /// If an app name conflicts with an existing registration, the new
    /// heuristic overwrites the previous one for that app name.
    public func register(_ heuristic: AppHeuristic) {
        lock.lock()
        defer { lock.unlock() }
        _heuristics.append(heuristic)
        for appName in heuristic.appNames {
            appNameMap[appName.lowercased()] = heuristic
        }
    }

    /// Registers custom heuristic rules from user configuration.
    ///
    /// This replaces any previously registered custom rules and re-registers
    /// them with the lookup table. Custom rules override built-in heuristics
    /// for the same app name.
    ///
    /// - Parameter rules: The custom rules to register.
    public func registerCustomRules(_ rules: [CustomHeuristicRule]) {
        lock.lock()
        defer { lock.unlock() }

        // Remove previously registered custom heuristics
        removeCustomHeuristicsLocked()

        // Store the new rules
        _customRules = rules

        // Register each rule as a CustomHeuristic
        for rule in rules {
            let heuristic = CustomHeuristic(rule: rule)
            _heuristics.append(heuristic)
            for appName in heuristic.appNames {
                appNameMap[appName.lowercased()] = heuristic
            }
        }
    }

    /// Removes all custom heuristics from the registry, restoring built-in defaults.
    /// Caller must already hold `lock`.
    private func removeCustomHeuristicsLocked() {
        // Remove custom heuristics from the list
        _heuristics.removeAll { $0 is CustomHeuristic }

        // Rebuild the lookup map from remaining (built-in) heuristics
        appNameMap = [:]
        for heuristic in _heuristics {
            for appName in heuristic.appNames {
                appNameMap[appName.lowercased()] = heuristic
            }
        }

        _customRules = []
    }

    /// Returns whether the given app name has a built-in heuristic.
    ///
    /// Used to determine if a heuristic rule is built-in (non-deletable)
    /// or user-defined.
    public func isBuiltIn(appName: String) -> Bool {
        let lowered = appName.lowercased()
        lock.lock()
        defer { lock.unlock() }
        // A user custom rule overriding this app makes it user-defined (deletable),
        // even if a built-in heuristic also targets the same app name.
        if _customRules.contains(where: { $0.appName.lowercased() == lowered }) {
            return false
        }
        return Self.builtInHeuristics.contains { heuristic in
            heuristic.appNames.contains { $0.lowercased() == lowered }
        }
    }
}
