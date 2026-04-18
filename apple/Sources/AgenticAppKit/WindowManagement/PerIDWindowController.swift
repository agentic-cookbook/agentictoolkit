import AppKit

/// A reusable base class for "one window per ID" controllers — e.g. a detail
/// window per database row, or an info window per session identifier.
///
/// Subclasses declare a domain identifier via the `ID` generic parameter and
/// register instances in a shared per-ID registry. Opening the same ID twice
/// brings the existing window to front instead of spawning a duplicate; the
/// window is cleared from the registry automatically when it closes.
///
/// Typical subclass:
/// ```swift
/// final class SessionInfoWindowController: PerIDWindowController<String> {
///     private let http: DaemonHTTPClient
///
///     init(id: String, http: DaemonHTTPClient) {
///         self.http = http
///         super.init(id: id, windowID: "sessionInfo.\(id)")
///     }
///
///     override var windowTitle: String { "Session \(id.prefix(8))" }
///     override var defaultContentRect: NSRect { NSRect(x: 0, y: 0, width: 600, height: 520) }
///     override func makeContentViewController() -> NSViewController? {
///         SessionInfoViewController(sessionId: id, http: http)
///     }
///
///     static func present(id: String, http: DaemonHTTPClient) {
///         present(id: id) { SessionInfoWindowController(id: id, http: http) }
///     }
/// }
/// ```
///
/// Registry lookup is keyed off the Swift metatype + ID, so each subclass
/// has its own isolated ID space.
@MainActor
open class PerIDWindowController<ID: Hashable>: SingleWindowController {

    public let id: ID

    public init(id: ID, windowID: String) {
        self.id = id
        super.init(windowID: windowID)
        PerIDRegistry.shared.set(self, type: ObjectIdentifier(Self.self), id: id)
    }

    /// Brings the window for `id` to front if one already exists; otherwise
    /// creates a new controller via `factory`, stores it in the registry,
    /// and shows it.
    @discardableResult
    public static func present(
        id: ID,
        factory: () -> PerIDWindowController<ID>
    ) -> PerIDWindowController<ID> {
        if let existing: PerIDWindowController<ID> =
            PerIDRegistry.shared.get(type: ObjectIdentifier(Self.self), id: id) {
            existing.showWindow()
            return existing
        }
        let controller = factory()
        controller.showWindow()
        return controller
    }

    /// The currently-registered controller for `id`, if any.
    public static func controller(for id: ID) -> PerIDWindowController<ID>? {
        PerIDRegistry.shared.get(type: ObjectIdentifier(Self.self), id: id)
    }

    open func windowWillClose(_ notification: Notification) {
        PerIDRegistry.shared.remove(type: ObjectIdentifier(Self.self), id: id)
    }
}

// MARK: - Registry

/// Shared registry for all `PerIDWindowController<ID>` subclasses. Keyed
/// by `(subclass metatype, id)` so each subclass has an isolated ID space.
///
/// Singleton to avoid a global, `@MainActor` to avoid any locking concerns.
@MainActor
private final class PerIDRegistry {
    static let shared = PerIDRegistry()
    private init() {}

    private struct Key: Hashable {
        let type: ObjectIdentifier
        let id: AnyHashable
    }

    private var storage: [Key: AnyObject] = [:]

    func set<ID: Hashable>(_ controller: AnyObject, type: ObjectIdentifier, id: ID) {
        storage[Key(type: type, id: AnyHashable(id))] = controller
    }

    func get<C: AnyObject, ID: Hashable>(type: ObjectIdentifier, id: ID) -> C? {
        storage[Key(type: type, id: AnyHashable(id))] as? C
    }

    func remove<ID: Hashable>(type: ObjectIdentifier, id: ID) {
        storage.removeValue(forKey: Key(type: type, id: AnyHashable(id)))
    }
}
