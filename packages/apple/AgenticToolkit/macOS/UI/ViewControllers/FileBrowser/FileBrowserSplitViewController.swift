import AppKit

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A file browser that shows what you click: the tree on the left, the selected
/// file on the right.
///
/// The two halves are separate controllers wired by a shared
/// `FileBrowserSelection`, so this type is only composition — divider,
/// thicknesses, autosave (`composition-over-inheritance`). It is what a host
/// installs when it wants "the file browser"; `FileBrowserViewController` alone
/// remains the right choice for a tree with no room for a viewer beside it.
@MainActor
public final class FileBrowserSplitViewController: ThemedSplitViewController {

    /// The tree half. Exposed so a host can force a resync or read the manager.
    public let browserViewController: FileBrowserViewController

    /// The display half.
    public let viewerViewController: FileViewerViewController

    /// What the tree selects and the viewer shows.
    public let selection: FileBrowserSelection

    /// Divider-position autosave key. AppKit keys these globally, so two split
    /// views alive at once under one name fight over the same stored position.
    /// Callers that can have more than one pass a distinct name.
    private let splitAutosaveName: String

    /// - Parameters:
    ///   - rootURL: The directory to show.
    ///   - cacheURL: Where the scan cache is written, and a directory excluded
    ///     from the scan.
    ///   - config: Which directory extensions are opaque packages, and the
    ///     `UserDefaults` keys backing the browser's settings.
    ///   - ignorePatterns: Wildcard filename patterns to leave out of the tree.
    ///   - autosaveName: Divider-position key; distinct per pane when a host can
    ///     open more than one.
    public init(
        rootURL: URL,
        cacheURL: URL,
        config: FileTreeConfig = .default,
        ignorePatterns: [String] = [],
        autosaveName: String = "file-browser-split"
    ) {
        let selection = FileBrowserSelection()
        self.selection = selection
        self.browserViewController = FileBrowserViewController(
            rootURL: rootURL,
            cacheURL: cacheURL,
            config: config,
            ignorePatterns: ignorePatterns,
            selection: selection
        )
        self.viewerViewController = FileViewerViewController(selection: selection)
        self.splitAutosaveName = autosaveName
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        let treeItem = NSSplitViewItem(viewController: browserViewController)
        treeItem.minimumThickness = 180
        treeItem.maximumThickness = 420
        treeItem.canCollapse = true
        // The tree keeps its width when the pane is resized; the viewer, which
        // has the text in it, takes the space.
        treeItem.holdingPriority = .defaultLow + 1

        let viewerItem = NSSplitViewItem(viewController: viewerViewController)
        // Below this the gutter and minimap crowd out the text itself.
        viewerItem.minimumThickness = 320

        addSplitViewItem(treeItem)
        addSplitViewItem(viewerItem)

        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.autosaveName = NSSplitView.AutosaveName(splitAutosaveName)
    }

    /// Collapses or restores the tree, leaving the viewer the whole pane.
    public func toggleTree() {
        guard let treeItem = splitViewItems.first else { return }
        treeItem.animator().isCollapsed = !treeItem.isCollapsed
    }
}

extension FileBrowserSplitViewController: PaneContentTeardown {
    /// Forwarded to the tree, which owns the FSEvents stream and the debounced
    /// git work. A closed pane must stop both whether or not its view ever got a
    /// `viewDidDisappear`.
    public func paneContentWillBeDiscarded() {
        browserViewController.paneContentWillBeDiscarded()
    }
}
