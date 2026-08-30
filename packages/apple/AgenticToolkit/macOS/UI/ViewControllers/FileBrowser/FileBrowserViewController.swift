import AppKit
import Combine
import CryptoKit
import SwiftUI

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// AppKit host for the SwiftUI file tree, so a file browser can be dropped into
/// any AppKit container — a document pane, a sidebar, a window.
///
/// Owns one `FileTreeManager` per root directory, and starts/stops watching with
/// the view's appearance: a browser in a hidden tab has no business running an
/// FSEvents stream and re-shelling `git status` every time a build writes.
@MainActor
public final class FileBrowserViewController: NSViewController {

    /// The roots this browser shows. A host that wants the `+`/`−` footer to
    /// outlive the pane owns this object and hands it in.
    public let directories: FileBrowserDirectories

    /// The primary root's manager. Exposed so a host can force a resync or read
    /// the detected IDE — those are questions about *the project*, which is the
    /// primary root, not about a directory someone dragged in beside it.
    public var manager: FileTreeManager { managerForPrimary }

    /// What the user has clicked. Shared rather than private so a host can put
    /// a viewer next to the tree — see `FileBrowserSplitViewController`.
    public let selection: FileBrowserSelection

    private let cacheURL: URL
    private let config: FileTreeConfig
    private let ignorePatterns: [String]

    /// One manager per root, keyed by the root it scans, so rebuilding the list
    /// after an add or a remove reuses every manager that survived — a scanned
    /// tree is not rescanned because a *different* directory appeared.
    private var managersByRoot: [URL: FileTreeManager] = [:]
    private let roots = FileBrowserRootsModel()

    private var isWatching = false
    private var hasLoaded = false
    private var cancellables = Set<AnyCancellable>()

    /// - Parameters:
    ///   - directories: The roots to show. The primary is the project itself;
    ///     the rest are the user's additions.
    ///   - cacheURL: Where scan caches are written, and a directory excluded
    ///     from the scan. For a document-backed browser this is the document's
    ///     own package, so the browser neither indexes nor thrashes on it.
    ///   - config: Which directory extensions are opaque packages, and the
    ///     `UserDefaults` keys backing the browser's settings.
    ///   - ignorePatterns: Wildcard filename patterns to leave out of the tree.
    ///   - selection: The selection this tree drives. Defaults to one of its
    ///     own, so a browser used alone needs to know nothing about it.
    public init(
        directories: FileBrowserDirectories,
        cacheURL: URL,
        config: FileTreeConfig = .default,
        ignorePatterns: [String] = [],
        selection: FileBrowserSelection = FileBrowserSelection()
    ) {
        self.directories = directories
        self.cacheURL = cacheURL
        self.config = config
        self.ignorePatterns = ignorePatterns
        self.selection = selection
        super.init(nibName: nil, bundle: nil)

        rebuildManagers()
        directories.$additional
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.rebuildManagers() }
            .store(in: &cancellables)
    }

    /// A browser over a single directory, with nothing to add to or remove.
    public convenience init(
        rootURL: URL,
        cacheURL: URL,
        config: FileTreeConfig = .default,
        ignorePatterns: [String] = [],
        selection: FileBrowserSelection = FileBrowserSelection()
    ) {
        self.init(
            directories: FileBrowserDirectories(primary: rootURL),
            cacheURL: cacheURL,
            config: config,
            ignorePatterns: ignorePatterns,
            selection: selection
        )
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    public override func loadView() {
        let hosting = NSHostingView(
            rootView: FileBrowserPaneView(
                roots: roots,
                directories: directories,
                selection: selection,
                onAdd: { [weak self] in self?.addDirectory() }
            ).themedRoot()
        )
        hosting.frame = NSRect(x: 0, y: 0, width: 260, height: 400)
        view = hosting
    }

    public override func viewWillAppear() {
        super.viewWillAppear()
        // `loadInitial()` reads the cache and kicks off a scan; doing it once
        // keeps a tab switch from re-scanning the whole tree.
        if !hasLoaded {
            hasLoaded = true
            managersByRoot.values.forEach { $0.loadInitial() }
        }
        startWatching()
    }

    public override func viewDidDisappear() {
        super.viewDidDisappear()
        stopWatching()
    }

    // MARK: - Directories

    /// Asks for directories and adds them. Public so a menu item or a host's
    /// own button can drive the same path the footer's `+` does (`dry`).
    @objc public func addDirectory() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = true
        panel.prompt = "Add"
        panel.message = "Choose directories to show in this project's file browser."
        guard panel.runModal() == .OK else { return }
        // A directory already in the list is not an error worth a dialog: the
        // user asked for it to be there, and it is.
        panel.urls.forEach { directories.add($0) }
    }

    /// Removes the root the footer's `−` targets, if it is a removable one.
    @objc public func removeSelectedDirectory() {
        guard let root = directories.selectedRoot else { NSSound.beep(); return }
        if !directories.remove(root) { NSSound.beep() }
    }

    /// Rebuilds the manager list to match `directories.all`, reusing the
    /// managers whose roots are still listed and tearing down the rest.
    private func rebuildManagers() {
        let wanted = directories.all
        var rebuilt: [URL: FileTreeManager] = [:]
        var ordered: [FileTreeManager] = []

        for root in wanted {
            let manager = managersByRoot[root] ?? makeManager(for: root)
            rebuilt[root] = manager
            ordered.append(manager)
        }

        for (root, manager) in managersByRoot where rebuilt[root] == nil {
            manager.stopWatching()
            // A pane's selection must not outlive the directory it came from,
            // or the viewer keeps showing a file the tree no longer lists.
            if let selected = selection.selectedNode?.url,
               selected.path == root.path || selected.path.hasPrefix(root.path + "/") {
                selection.selectedNode = nil
            }
        }

        managersByRoot = rebuilt
        roots.managers = ordered

        // A directory added while the browser is already on screen has missed
        // both `viewWillAppear` hooks, so it gets them here.
        if hasLoaded {
            for manager in ordered where manager.rootNode == nil {
                manager.loadInitial()
            }
        }
        if isWatching {
            ordered.forEach { $0.startWatching() }
        }
    }

    private func makeManager(for root: URL) -> FileTreeManager {
        FileTreeManager(
            repoRootURL: root,
            packageURL: Self.cacheURL(forRoot: root, primary: directories.primary, base: cacheURL),
            config: config,
            ignorePatterns: ignorePatterns
        )
    }

    /// Where one root's scan cache lives.
    ///
    /// The primary keeps the base directory itself, so an existing project's
    /// cache is still found after this became multi-root. Added directories get
    /// a subdirectory named for their path, because `FileTreeCache` writes one
    /// fixed filename and two roots sharing a directory would overwrite each
    /// other's tree.
    private static func cacheURL(forRoot root: URL, primary: URL, base: URL) -> URL {
        guard root != primary else { return base }
        let digest = SHA256.hash(data: Data(root.path.utf8))
        let name = digest.prefix(8).map { String(format: "%02x", $0) }.joined()
        let url = base
            .appendingPathComponent("directory-caches", isDirectory: true)
            .appendingPathComponent(name, isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    private var managerForPrimary: FileTreeManager {
        // `rebuildManagers()` runs in `init` and always inserts the primary, so
        // a miss here means the invariant broke — say so rather than papering
        // over it with a throwaway manager (`fail-fast`).
        guard let manager = managersByRoot[directories.primary] else {
            preconditionFailure("No manager for the primary root \(directories.primary.path)")
        }
        return manager
    }

    // MARK: - Watching

    private func startWatching() {
        guard !isWatching else { return }
        isWatching = true
        managersByRoot.values.forEach { $0.startWatching() }
    }

    private func stopWatching() {
        guard isWatching else { return }
        isWatching = false
        managersByRoot.values.forEach { $0.stopWatching() }
    }
}

extension FileBrowserViewController: PaneContentTeardown {
    /// Closing the pane ends the FSEvents streams and the debounced git/IDE
    /// work, whether or not the view ever got a `viewDidDisappear`.
    public func paneContentWillBeDiscarded() {
        stopWatching()
    }
}

/// The managers the pane draws, as one observable list.
///
/// The view cannot observe a dictionary owned by a view controller, and making
/// the controller itself observable would publish far more than the one fact
/// SwiftUI needs (`separation-of-concerns`).
@MainActor
final class FileBrowserRootsModel: ObservableObject {
    @Published var managers: [FileTreeManager] = []
}

/// The pane's own chrome: the trees, and the footer that adds and removes them.
private struct FileBrowserPaneView: View {

    @ObservedObject var roots: FileBrowserRootsModel
    @ObservedObject var directories: FileBrowserDirectories
    @ObservedObject var selection: FileBrowserSelection

    let onAdd: () -> Void

    @Environment(\.theme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            FileTreeRootsView(
                managers: roots.managers,
                selectedRoot: $directories.selectedRoot,
                selectedNode: $selection.selectedNode
            )
            Divider()
            footer
        }
        .background(theme.windowBackground)
        // Clicking a file is also how you say which directory you mean, so the
        // footer's target follows the tree rather than needing its own click.
        .onChange(of: selection.selectedNode) { _, node in
            if let url = node?.url, let root = directories.root(containing: url) {
                directories.selectedRoot = root
            }
        }
    }

    private var footer: some View {
        HStack(spacing: 2) {
            Button(action: onAdd) {
                Image(systemName: "plus")
            }
            .help("Add a directory to this project")
            .accessibilityIdentifier("file-browser.add-directory")

            Button {
                if let root = directories.selectedRoot {
                    directories.remove(root)
                }
            } label: {
                Image(systemName: "minus")
            }
            .disabled(!canRemoveSelection)
            .help(removeHelp)
            .accessibilityIdentifier("file-browser.remove-directory")

            Spacer()
        }
        .buttonStyle(.borderless)
        .foregroundStyle(theme.secondaryText)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(theme.surface)
    }

    private var canRemoveSelection: Bool {
        guard let root = directories.selectedRoot else { return false }
        return directories.isRemovable(root)
    }

    private var removeHelp: String {
        guard let root = directories.selectedRoot, directories.isRemovable(root) else {
            // The project's own folder is always there, so saying *why* the
            // button is off beats an unexplained gray minus.
            return "Select an added directory to remove it"
        }
        return "Remove “\(root.lastPathComponent)” from this project"
    }
}
