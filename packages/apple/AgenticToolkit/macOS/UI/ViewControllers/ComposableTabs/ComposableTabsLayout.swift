import AppKit
import Foundation
import AgenticToolkitCore

/// Everything a document needs to build its tabs: which views exist, and which
/// arrangements of them are legal.
///
/// The two halves only make sense together — a spec naming a view no registry
/// vends is broken, and a registry with no spec has nothing to say about where
/// its views may go — so they are installed, validated and handed around as one
/// value. A document holds one; the demo document controller stamps its own on
/// the documents it opens, which is what lets demo content and real content
/// coexist in one process.
public final class ComposableTabsLayout: Sendable {

    /// The registry is a `@MainActor` class, so holding it here is safe from
    /// anywhere while everything it *does* stays on the main actor — which is
    /// what lets the document's off-main `write(to:ofType:)` reach `spec`.
    public let registry: ComposableTabsViewRegistry

    public let spec: ComposableTabLayoutSpec

    /// Validates the spec against the registry up front, so a spec that names a
    /// view nobody vends fails at install time rather than on the first user
    /// gesture that consults it (`fail-fast`).
    @MainActor
    public init(registry: ComposableTabsViewRegistry, spec: ComposableTabLayoutSpec) throws {
        try spec.validate(against: registry)
        self.registry = registry
        self.spec = spec
    }

    /// The layout a brand-new tab starts with.
    public nonisolated func blueprint() -> LayoutNode {
        spec.blueprint()
    }

    // MARK: - The app's installed layout

    private static let lock = NSLock()
    nonisolated(unsafe) private static var installedLayout: ComposableTabsLayout?

    /// Installs the layout new documents get. Set it before any document window
    /// loads; passing `nil` restores the built-in two-placeholder split.
    public static func install(_ layout: ComposableTabsLayout?) {
        lock.lock()
        installedLayout = layout
        lock.unlock()
    }

    /// The installed layout, or `nil` when the app never installed one.
    /// `nonisolated` because `ComposableTabsDocument.write(to:ofType:)` can run
    /// off the main actor and needs the same answer everyone else gets.
    public nonisolated static var current: ComposableTabsLayout? {
        lock.lock()
        defer { lock.unlock() }
        return installedLayout
    }

    /// The blueprint a new tab starts with, whether or not an app installed a
    /// layout. Four places used to mint their own copy of "two placeholders,
    /// side by side"; that is one piece of knowledge, so it gets one
    /// representation (`dry`).
    public nonisolated static func makeTabLayout() -> LayoutNode {
        (current?.spec ?? .placeholders).blueprint()
    }

    /// The fallback a document falls back to when no app layout is installed —
    /// placeholders only, which is what an unconfigured host showed before.
    /// Built on demand and cached, because a registry is main-actor state.
    @MainActor
    public static func placeholderOnly() -> ComposableTabsLayout {
        if let cached = cachedPlaceholderOnly { return cached }
        // `.placeholders` names only `.placeholder`, which every registry
        // registers, so validation cannot fail here.
        // swiftlint:disable:next force_try
        let layout = try! ComposableTabsLayout(
            registry: ComposableTabsViewRegistry(),
            spec: .placeholders
        )
        cachedPlaceholderOnly = layout
        return layout
    }

    @MainActor private static var cachedPlaceholderOnly: ComposableTabsLayout?
}
