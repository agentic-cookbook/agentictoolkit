import AppKit
import Combine
import AgenticToolkitCore

/// Top-level coordinator for window infrastructure. Owns a
/// `WindowFrameManager` (frame persistence + screen-change handling),
/// a `WindowRegistry` (live `SingleWindowController` lookup), and the
/// recents/reopen-on-launch policy for both document and non-document
/// single windows.
///
/// Most callers go through one of the sub-services: e.g.
/// `WindowManager.shared.frames.restoreFrame(...)` or
/// `WindowManager.shared.registry.controller(forID:)`. Recents recording
/// happens automatically — `SingleWindowController` lifecycle hooks call
/// `windowDidInteract(_:kind:)` and the manager routes from there.
@MainActor
public final class WindowManager {

    public static let shared = WindowManager()

    /// Frame persistence + screen-change handling.
    public let frames: WindowFrameManager

    /// Live `SingleWindowController` lookup by `windowID`.
    public let registry = WindowRegistry()

    public enum InteractionKind: Sendable {
        case show
        case close
    }

    /// AppKit's UserDefaults key for the recent-documents cap. Writing this
    /// adjusts `NSDocumentController.maximumRecentDocumentCount` (which is
    /// otherwise read-only) without subclassing `NSDocumentController`.
    private static let recentDocumentsLimitKey = "NSRecentDocumentsLimit"

    private var recentCountCancellable: AnyCancellable?

    public init(
        screenProvider: ScreenProvider = RealScreenProvider(),
        storage: WindowStateStorage = SettingsStoreWindowStateStorage(settings: UserSettings.shared)
    ) {
        self.frames = WindowFrameManager(screenProvider: screenProvider, storage: storage)
        applyRecentDocumentCountFromSettings()
        // Mirror future setting changes through to AppKit.
        recentCountCancellable = UserSettings.recentWindowsCount.$currentValue
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.applyRecentDocumentCountFromSettings() }
    }

    // MARK: - Recents recording

    /// Lifecycle event from `SingleWindowController`. The manager owns the
    /// policy: spec lookup, behavior gating, OS-level recents call for
    /// document windows. AppKit auto-discovers the Open Recent submenu by
    /// finding any menu item whose action is `clearRecentDocuments:` — no
    /// explicit binding is needed here.
    public func windowDidInteract(_ controller: SingleWindowController, kind: InteractionKind) {
        guard kind == .show else { return }
        guard let spec = controller.windowSpec, spec.behavior.contains(.includeInRecents) else { return }

        if let url = controller.documentURL {
            NSDocumentController.shared.noteNewRecentDocumentURL(url)
        }
        // Single-window (non-document) tracking is intentionally a no-op
        // here; it lands in a follow-up slice with `WindowRecentsTracker`.
    }

    // MARK: - Eviction count

    /// Mirrors `UserSettings.recentWindowsCount` into AppKit's recent-
    /// documents limit. Writing the `NSRecentDocumentsLimit` user default
    /// is the public knob — `maximumRecentDocumentCount` itself is
    /// read-only. AppKit honors the new limit on the next
    /// `noteNewRecentDocumentURL` call.
    public func applyRecentDocumentCountFromSettings() {
        let count = UserSettings.recentWindowsCount.currentValue
        UserDefaults.standard.set(count, forKey: Self.recentDocumentsLimitKey)
    }

    // MARK: - Reopen on launch

    /// Decides whether to re-show document windows from
    /// `NSDocumentController.recentDocumentURLs` based on the user's
    /// `reopenOnLaunchPolicy`. Hosts call this from
    /// `applicationDidFinishLaunching`.
    public func reopenRecentsOnLaunch() {
        let policy = UserSettings.reopenOnLaunchPolicy.currentValue
        let shouldReopen = policy.shouldReopen(systemDefault: ReopenOnLaunchPolicy.systemDefault)

        if !shouldReopen {
            // Override AppKit's own state restoration: close any document
            // windows it auto-restored. Iterate windowControllers so we
            // close the controller (not just the window).
            for window in NSApp.windows {
                guard let controller = window.windowController, controller.document != nil else { continue }
                controller.close()
            }
            return
        }

        // Skip URLs AppKit has already restored to avoid duplicate windows.
        let alreadyOpen: Set<URL> = Set(
            NSApp.windows.compactMap {
                ($0.windowController?.document as? NSDocument)?.fileURL
            }
        )
        for url in NSDocumentController.shared.recentDocumentURLs where !alreadyOpen.contains(url) {
            NSDocumentController.shared.openDocument(
                withContentsOf: url,
                display: true
            ) { _, _, _ in }
        }
    }
}

extension SingleWindowController {

    /// URL of this controller's `NSDocument`, if any. Used by
    /// `WindowManager.windowDidInteract(_:kind:)` to route document windows
    /// through `NSDocumentController.shared.noteNewRecentDocumentURL(_:)`.
    public var documentURL: URL? {
        (document as? NSDocument)?.fileURL
    }
}
