import Foundation

/// A feature that exposes Cocoa Scripting / Apple Events accessors. Hosts
/// register contributors with a `ScriptingRouter` that owns the dispatch
/// table; the host's `AppDelegate` overrides `value(forUndefinedKey:)`,
/// `setValue(_:forUndefinedKey:)`, and `forwardingTarget(for:)` once and
/// routes everything through the router.
///
/// The contributor declares which keys it owns (so `delegateHandlesKey`
/// and KVC routing can resolve quickly) and provides per-key getters and
/// setters. Indexed scripting accessors (`valueIn<X>WithUniqueID:`) are
/// owned by the router itself, which calls feature-specific lookup methods.
@MainActor
public protocol ScriptingContributor: AnyObject {
    /// The set of KVC keys this contributor handles. Used by the host's
    /// `application(_:delegateHandlesKey:)` and to resolve KVC reads/writes.
    var scriptingKeys: Set<String> { get }

    /// Read the value for a key in `scriptingKeys`. Return `nil` if the key
    /// is unknown — the router will move on to the next contributor.
    func value(forScriptingKey key: String) -> Any?

    /// Write the value for a key in `scriptingKeys`. Default no-op; override
    /// for read-write keys.
    func setValue(_ value: Any?, forScriptingKey key: String)
}

extension ScriptingContributor {
    public func setValue(_ value: Any?, forScriptingKey key: String) {}
}
