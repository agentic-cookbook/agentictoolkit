import Foundation

/// The layout a brand-new tab starts with.
///
/// Four places used to mint their own copy of "two placeholders, side by side"
/// — `WhippetDocumentController.writeEmptyPackage`, the document's
/// `initialTabs()` and its off-main `write(to:ofType:)`, and the window
/// controller's new-tab path. That is one piece of knowledge, so it gets one
/// representation, and an app that registers real pane content can replace it
/// in a single call instead of four.
///
/// This is the seam `ComposableTabLayoutSpec.blueprint()` takes over in phase 5
/// of the ComposableTabs refactor; until then it is a bare provider closure.
public enum DocumentLayoutBlueprint {

    public typealias Provider = @Sendable () -> LayoutNode

    private static let lock = NSLock()
    nonisolated(unsafe) private static var customProvider: Provider?

    /// Installs the app's layout. Set it before any document window loads;
    /// passing `nil` restores the built-in two-placeholder split.
    public static func setProvider(_ provider: Provider?) {
        lock.lock()
        customProvider = provider
        lock.unlock()
    }

    /// Deliberately `nonisolated` and lock-guarded: `NestedSplitViewDocument`'s
    /// `write(to:ofType:)` can run off the main actor, and it needs the same
    /// answer everyone else gets.
    public static func makeTabLayout() -> LayoutNode {
        lock.lock()
        let provider = customProvider
        lock.unlock()
        return provider?() ?? twoPlaceholders()
    }

    private static func twoPlaceholders() -> LayoutNode {
        LayoutNode.split(
            orientation: "horizontal",
            first: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier),
            second: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier)
        )
    }
}
