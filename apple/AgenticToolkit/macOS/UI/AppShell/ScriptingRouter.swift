import AppKit

/// Routes Cocoa Scripting / Apple Events from the host's `AppDelegate` into
/// the feature coordinators that own each accessor.
///
/// Three routing surfaces:
///
/// 1. **KVC routing** — `value(forScriptingKey:)` /
///    `setValue(_:forScriptingKey:)` look up which `ScriptingContributor`
///    owns the requested key. The host overrides
///    `value(forUndefinedKey:)` and `setValue(_:forUndefinedKey:)` once and
///    delegates here.
///
/// 2. **Indexed-accessor selectors** — Cocoa Scripting calls fixed-name
///    selectors like `valueInSessionsWithUniqueID:` for `every session
///    whose uniqueID is X` queries. These are `@objc` methods on this
///    class; the host's `forwardingTarget(for:)` routes the selectors
///    here. Hosts register lookup closures via `registerUniqueIDLookup`
///    / `registerNameLookup` so the router can dispatch without knowing
///    each feature's API.
///
/// 3. **Typed feature registry** — `registerFeature(_:)` /
///    `feature(_:)` give toolkit-side `NSScriptCommand` subclasses a way
///    to find their owning coordinator without round-tripping through the
///    host's `AppDelegate`. The router itself conforms to `ScriptingHost`,
///    so a command does
///    `(NSApp.scriptingHost)?.feature(MyCoordinator.self)`.
@MainActor
public final class ScriptingRouter: NSObject {

    private var contributors: [ScriptingContributor] = []
    private var keyToContributor: [String: ScriptingContributor] = [:]

    public typealias UniqueIDLookup = (String) -> Any?
    public typealias NameLookup = (String) -> Any?

    private var uniqueIDLookups: [String: UniqueIDLookup] = [:]
    private var nameLookups: [String: NameLookup] = [:]

    /// Typed feature registry — keyed by the feature's metatype identity so
    /// `feature(MyCoordinator.self)` returns the registered instance.
    private var featuresByTypeID: [ObjectIdentifier: AnyObject] = [:]

    public override init() { super.init() }

    // MARK: - Registration

    public func register(_ contributor: ScriptingContributor) {
        contributors.append(contributor)
        for key in contributor.scriptingKeys {
            keyToContributor[key] = contributor
        }
    }

    public func registerUniqueIDLookup(forKey key: String, _ lookup: @escaping UniqueIDLookup) {
        uniqueIDLookups[key] = lookup
    }

    public func registerNameLookup(forKey key: String, _ lookup: @escaping NameLookup) {
        nameLookups[key] = lookup
    }

    /// Register a feature coordinator so toolkit-side commands can find it
    /// by type via `feature(_:)`. Keyed by the runtime type of `feature`
    /// (not the static type of the call site), so registering an array of
    /// `AppFeature`s registers each one under its concrete coordinator
    /// type. The router holds a strong reference; register a coordinator
    /// the host already owns elsewhere — registering alone isn't enough to
    /// keep a coordinator alive across its host's lifetime.
    public func registerFeature(_ feature: AnyObject) {
        featuresByTypeID[ObjectIdentifier(type(of: feature))] = feature
    }

    /// Look up a registered feature by its concrete type.
    public func feature<F: AnyObject>(_ type: F.Type) -> F? {
        featuresByTypeID[ObjectIdentifier(type)] as? F
    }

    // MARK: - KVC routing (called from AppDelegate)

    public func handles(key: String) -> Bool {
        keyToContributor[key] != nil
    }

    public func value(forScriptingKey key: String) -> Any? {
        keyToContributor[key]?.value(forScriptingKey: key)
    }

    @discardableResult
    public func setValue(_ value: Any?, forScriptingKey key: String) -> Bool {
        guard let contributor = keyToContributor[key] else { return false }
        contributor.setValue(value, forScriptingKey: key)
        return true
    }

    // MARK: - Indexed scripting accessors

    @objc public func valueInSessionsWithUniqueID(_ uniqueID: String) -> Any? {
        uniqueIDLookups["sessions"]?(uniqueID)
    }

    @objc public func valueInTerminalSessionsWithUniqueID(_ uniqueID: String) -> Any? {
        uniqueIDLookups["terminalSessions"]?(uniqueID)
    }

    @objc public func valueInScriptingSettingsWithName(_ name: String) -> Any? {
        nameLookups["scriptingSettings"]?(name)
    }
}

extension ScriptingRouter: ScriptingHost {}
