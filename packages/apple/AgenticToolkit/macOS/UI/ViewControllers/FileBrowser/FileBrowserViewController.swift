import AppKit
import SwiftUI

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// AppKit host for the SwiftUI file tree, so a file browser can be dropped into
/// any AppKit container — a document pane, a sidebar, a window.
///
/// Owns the `FileTreeManager` for its root, and starts/stops watching with the
/// view's appearance: a browser in a hidden tab has no business running an
/// FSEvents stream and re-shelling `git status` every time a build writes.
@MainActor
public final class FileBrowserViewController: NSViewController {

    /// Exposed so a host can force a resync or read the detected IDE.
    public let manager: FileTreeManager

    private var isWatching = false
    private var hasLoaded = false

    /// - Parameters:
    ///   - rootURL: The directory to show. Its `.git` directory, if any, drives
    ///     the status badges.
    ///   - cacheURL: Where the scan cache is written, and a directory excluded
    ///     from the scan. For a document-backed browser this is the document's
    ///     own package, so the browser neither indexes nor thrashes on it.
    ///   - config: Which directory extensions are opaque packages, and the
    ///     `UserDefaults` keys backing the browser's settings.
    ///   - ignorePatterns: Wildcard filename patterns to leave out of the tree.
    public init(
        rootURL: URL,
        cacheURL: URL,
        config: FileTreeConfig = .default,
        ignorePatterns: [String] = []
    ) {
        self.manager = FileTreeManager(
            repoRootURL: rootURL,
            packageURL: cacheURL,
            config: config,
            ignorePatterns: ignorePatterns
        )
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    public override func loadView() {
        let hosting = NSHostingView(rootView: FileBrowserPaneView(manager: manager).themedRoot())
        hosting.frame = NSRect(x: 0, y: 0, width: 260, height: 400)
        view = hosting
    }

    public override func viewWillAppear() {
        super.viewWillAppear()
        // `loadInitial()` reads the cache and kicks off a scan; doing it once
        // keeps a tab switch from re-scanning the whole tree.
        if !hasLoaded {
            hasLoaded = true
            manager.loadInitial()
        }
        startWatching()
    }

    public override func viewDidDisappear() {
        super.viewDidDisappear()
        stopWatching()
    }

    private func startWatching() {
        guard !isWatching else { return }
        isWatching = true
        manager.startWatching()
    }

    private func stopWatching() {
        guard isWatching else { return }
        isWatching = false
        manager.stopWatching()
    }
}

extension FileBrowserViewController: PaneContentTeardown {
    /// Closing the pane ends the FSEvents stream and the debounced git/IDE
    /// work, whether or not the view ever got a `viewDidDisappear`.
    public func paneContentWillBeDiscarded() {
        stopWatching()
    }
}

/// The pane's own chrome: the tree once it exists, a spinner while the first
/// scan runs, and an explicit empty state rather than a blank rectangle.
private struct FileBrowserPaneView: View {

    @ObservedObject var manager: FileTreeManager
    @State private var selectedNode: FileTreeNode?

    var body: some View {
        Group {
            if let root = manager.rootNode {
                FileTreeView(rootNode: root, selectedNode: $selectedNode)
            } else if manager.isSyncing {
                ProgressView()
                    .controlSize(.small)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Text("Nothing to show")
                    .font(.callout)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}
