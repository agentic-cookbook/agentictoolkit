import AppKit
import Combine

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The file tree: one collapsible section per root directory, and the files and
/// folders under it.
///
/// An `NSOutlineView` rather than a SwiftUI `List`. A list row on macOS keeps
/// its click handling to itself — a tap gesture attached to the row's content
/// never fires, and a directory's row, being a disclosure-group label, is not
/// something the list will select at all. Half the tree therefore answered a
/// click with nothing, which is the one thing a file browser must never do.
/// AppKit's outline selects on mouse-down for every row it draws, which is the
/// behaviour this needs and the platform already has (`native-controls`).
@MainActor
final class FileTreeOutlineViewController: NSViewController {

    /// The roots to draw, in display order.
    private let roots: FileBrowserRootsModel

    /// Which root the enclosing pane's `+`/`−` act on. Clicking anything in a
    /// tree — a header or a file — says which root the user means.
    private let directories: FileBrowserDirectories

    /// What the user has clicked.
    private let selection: FileBrowserSelection

    private let outline = ThemedOutlineView(role: .windowBackground)
    private let scrollView = ThemedScrollView()

    /// One placeholder row per empty root, kept rather than rebuilt so the
    /// outline sees the same object each time it asks (it identifies items by
    /// pointer, and a fresh one every call would collapse the row on reload).
    private var placeholders: [URL: Placeholder] = [:]

    /// One subscription per directory whose contents are being read, so the row
    /// redraws when they land. Keyed by node id, because a scan re-reading a
    /// directory hands back the same node.
    private var childWatchers: [String: AnyCancellable] = [:]

    private var cancellables = Set<AnyCancellable>()

    /// Set while the outline is being told about a selection that came *from*
    /// the model, so the resulting delegate callback does not write it back.
    private var isSyncingSelection = false

    init(
        roots: FileBrowserRootsModel,
        directories: FileBrowserDirectories,
        selection: FileBrowserSelection
    ) {
        self.roots = roots
        self.directories = directories
        self.selection = selection
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    // MARK: - View

    override func loadView() {
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("file"))
        column.resizingMask = .autoresizingMask
        outline.addTableColumn(column)
        outline.outlineTableColumn = column
        outline.headerView = nil
        outline.rowHeight = 22
        outline.indentationPerLevel = 14
        outline.style = .inset
        outline.allowsEmptySelection = true
        outline.allowsMultipleSelection = false
        outline.dataSource = self
        outline.delegate = self
        outline.target = self
        outline.doubleAction = #selector(rowDoubleClicked(_:))
        outline.autoresizesOutlineColumn = false
        outline.accessibilityID("file-browser.tree")

        scrollView.documentView = outline
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true

        view = scrollView
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        roots.$managers
            .receive(on: RunLoop.main)
            .sink { [weak self] managers in self?.observe(managers) }
            .store(in: &cancellables)

        // A root's header says which one the footer will act on, so it redraws
        // when that changes — including when a click on a *file* moved it.
        //
        // `removeDuplicates` is load-bearing, not an optimisation. Clicking a
        // file assigns the root it already lives under, and `@Published`
        // republishes an unchanged value, so without this every click in the
        // tree rebuilt the tree it had just been made in.
        directories.$selectedRoot
            .removeDuplicates()
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.reloadPreservingSelection() }
            .store(in: &cancellables)

        selection.$selectedNode
            .receive(on: RunLoop.main)
            .sink { [weak self] node in self?.showSelection(node) }
            .store(in: &cancellables)
    }

    // MARK: - Model observation

    /// One subscription per manager, replaced wholesale whenever the root list
    /// changes: a manager that is no longer shown has nothing to redraw.
    private var managerWatchers: [AnyCancellable] = []

    private func observe(_ managers: [FileTreeManager]) {
        managerWatchers = managers.flatMap { manager -> [AnyCancellable] in
            [
                manager.$rootNode
                    .receive(on: RunLoop.main)
                    .sink { [weak self] _ in self?.reloadPreservingSelection() },
                manager.$isSyncing
                    .receive(on: RunLoop.main)
                    .sink { [weak self] _ in self?.reloadPreservingSelection() }
            ]
        }
        reloadPreservingSelection()
    }

    /// Watches one directory's contents so the rows appear when the read that
    /// `loadChildrenIfNeeded()` started finishes.
    private func watchChildren(of node: FileTreeNode) {
        guard childWatchers[node.id] == nil else { return }
        childWatchers[node.id] = node.$children
            .dropFirst()
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                guard let self else { return }
                let wasExpanded = self.outline.isItemExpanded(node)
                let selected = self.outline.item(atRow: self.outline.selectedRow)
                // Same reason as `reloadPreservingSelection`: reloading rows
                // drops the outline's selection, and an unguarded drop reads
                // as the user deselecting the file they are reading.
                self.isSyncingSelection = true
                self.outline.reloadItem(node, reloadChildren: true)
                if wasExpanded { self.outline.expandItem(node) }
                self.reselect(selected)
                self.isSyncingSelection = false
            }
    }

    /// `reloadData` throws away the selection, and a git-status refresh runs it
    /// every few seconds — so the row the user is reading is put back.
    ///
    /// The whole reload runs under `isSyncingSelection`. The outline empties
    /// its selection *during* the reload and says so, and that report reaching
    /// `outlineViewSelectionDidChange` is what used to clear `selectedNode`
    /// and blank the viewer a moment after a click — a reload is the tree
    /// redrawing itself, never the user letting go of a file.
    private func reloadPreservingSelection() {
        let selected = outline.item(atRow: outline.selectedRow)
        isSyncingSelection = true
        outline.reloadData()
        // A single root shows its contents straight away: a tree that opens
        // onto one collapsed header makes the user click to see anything.
        if roots.managers.count == 1, let only = roots.managers.first {
            outline.expandItem(only)
        }
        reselect(selected)
        isSyncingSelection = false
    }

    /// Puts the outline back on `item` after a reload, if it is still drawn.
    /// A file that has been deleted or filtered away is a selection the model
    /// should lose too, so that case clears it rather than leaving the viewer
    /// showing a file the tree no longer lists (`fail-fast`).
    private func reselect(_ item: Any?) {
        guard let item else { return }
        let row = outline.row(forItem: item)
        if row >= 0 {
            outline.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false)
        } else if item is FileTreeNode {
            selection.selectedNode = nil
        }
    }

    /// Puts the outline on `node`, for a selection that was set from outside —
    /// a host restoring what was open, or a removed root clearing it.
    private func showSelection(_ node: FileTreeNode?) {
        guard let node else {
            if outline.item(atRow: outline.selectedRow) is FileTreeNode {
                isSyncingSelection = true
                outline.deselectAll(nil)
                isSyncingSelection = false
            }
            return
        }
        guard outline.item(atRow: outline.selectedRow) as? FileTreeNode != node else { return }
        let row = outline.row(forItem: node)
        guard row >= 0 else { return }
        isSyncingSelection = true
        outline.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false)
        outline.scrollRowToVisible(row)
        isSyncingSelection = false
    }

    // MARK: - Activation

    @objc private func rowDoubleClicked(_ sender: Any?) {
        let item = outline.item(atRow: outline.selectedRow)
        if let manager = item as? FileTreeManager {
            toggle(manager)
            return
        }
        guard let node = item as? FileTreeNode else { return }
        // A directory has nothing to open, so a double-click means what it
        // means everywhere else: show me what is inside, or stop showing me.
        if node.children != nil {
            toggle(node)
        } else {
            NSWorkspace.shared.open(node.url)
        }
    }

    private func toggle(_ item: Any) {
        if outline.isItemExpanded(item) {
            outline.collapseItem(item)
        } else {
            outline.expandItem(item)
        }
    }

    // MARK: - Items

    /// The "nothing here" row under an empty root. A class so the outline has
    /// an object to identify the row by.
    fileprivate final class Placeholder {
        var text: String
        init(_ text: String) { self.text = text }
    }

    private func placeholder(for manager: FileTreeManager) -> Placeholder {
        let text = manager.isSyncing ? "Scanning…" : "Empty"
        if let existing = placeholders[manager.repoRootURL] {
            existing.text = text
            return existing
        }
        let made = Placeholder(text)
        placeholders[manager.repoRootURL] = made
        return made
    }

    fileprivate func children(of item: Any?) -> [Any] {
        switch item {
        case nil:
            return roots.managers
        case let manager as FileTreeManager:
            let children = manager.rootNode?.children ?? []
            return children.isEmpty ? [placeholder(for: manager)] : children
        case let node as FileTreeNode:
            return node.children ?? []
        default:
            return []
        }
    }
}

// MARK: - Outline

extension FileTreeOutlineViewController: NSOutlineViewDataSource, NSOutlineViewDelegate {

    func outlineView(_ outlineView: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int {
        children(of: item).count
    }

    func outlineView(_ outlineView: NSOutlineView, child index: Int, ofItem item: Any?) -> Any {
        children(of: item)[index]
    }

    func outlineView(_ outlineView: NSOutlineView, isItemExpandable item: Any) -> Bool {
        if item is FileTreeManager { return true }
        // `[]` is a directory nobody has opened yet and `nil` is a leaf — the
        // distinction `FileTreeNode` draws so a triangle can appear before the
        // directory has been read.
        return (item as? FileTreeNode)?.children != nil
    }

    func outlineViewItemWillExpand(_ notification: Notification) {
        guard let node = notification.userInfo?["NSObject"] as? FileTreeNode else { return }
        watchChildren(of: node)
        node.loadChildrenIfNeeded()
    }

    func outlineView(_ outlineView: NSOutlineView, rowViewForItem item: Any) -> NSTableRowView? {
        ThemedTableRowView()
    }

    func outlineView(_ outlineView: NSOutlineView, shouldSelectItem item: Any) -> Bool {
        !(item is Placeholder)
    }

    func outlineView(
        _ outlineView: NSOutlineView,
        viewFor tableColumn: NSTableColumn?,
        item: Any
    ) -> NSView? {
        let palette = ThemePaletteObserver.currentPalette
        switch item {
        case let manager as FileTreeManager:
            let isTarget = directories.selectedRoot == manager.repoRootURL
            let label = ThemedLabel(
                string: manager.repoRootURL.lastPathComponent,
                role: isTarget ? .primaryText : .secondaryText,
                textRole: .caption
            )
            label.toolTip = manager.repoRootURL.path
            return FileTreeRowView(content: label, palette: palette)
        case let placeholder as Placeholder:
            return FileTreeRowView(
                content: ThemedLabel(string: placeholder.text, role: .tertiaryText, textRole: .caption),
                palette: palette
            )
        case let node as FileTreeNode:
            return FileTreeNodeRowView(node: node, palette: palette)
        default:
            return nil
        }
    }

    func outlineViewSelectionDidChange(_ notification: Notification) {
        guard !isSyncingSelection else { return }
        let item = outline.item(atRow: outline.selectedRow)

        if let manager = item as? FileTreeManager {
            directories.selectedRoot = manager.repoRootURL
            return
        }

        let node = item as? FileTreeNode
        selection.selectedNode = node
        // Clicking a file is also how you say which directory you mean, so the
        // footer's target follows the tree rather than needing its own click.
        if let url = node?.url, let root = directories.root(containing: url) {
            directories.selectedRoot = root
        }
    }
}

// MARK: - Rows

/// A row that holds one view, inset and vertically centred. Its own type so the
/// header and placeholder rows lay out the same way the file rows do (`dry`).
@MainActor
private class FileTreeRowView: NSView {

    init(content: NSView, palette: SemanticPalette) {
        super.init(frame: .zero)
        content.translatesAutoresizingMaskIntoConstraints = false
        addSubview(content)
        NSLayoutConstraint.activate([
            content.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            content.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -6),
            content.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
}

/// One file or directory: an icon, the name, and the git status character.
@MainActor
private final class FileTreeNodeRowView: FileTreeRowView {

    init(node: FileTreeNode, palette: SemanticPalette) {
        let icon = NSImageView(image: NSImage(
            systemSymbolName: node.systemImageName,
            accessibilityDescription: node.isDirectory ? "Folder" : "File"
        ) ?? NSImage())
        icon.contentTintColor = Self.iconColor(for: node, palette: palette)
        icon.setContentHuggingPriority(.required, for: .horizontal)

        // The status colors are git's own vocabulary, not app chrome, so they
        // stay the fixed red/green/orange every git client uses rather than
        // being remapped onto theme roles.
        let name = ThemedLabel(string: node.name, role: .primaryText, textRole: .body)
        name.lineBreakMode = .byTruncatingMiddle
        name.cell?.usesSingleLineMode = true
        if let status = node.gitStatus {
            name.textColor = status.nsColor
        }
        name.toolTip = node.url.path

        var views: [NSView] = [icon, name]
        if let status = node.gitStatus {
            let badge = ThemedLabel(string: status.displayCharacter, role: .primaryText, textRole: .code)
            badge.textColor = status.nsColor
            badge.setContentHuggingPriority(.required, for: .horizontal)
            views.append(contentsOf: [NSView(), badge])
        }

        let stack = NSStackView(views: views)
        stack.orientation = .horizontal
        stack.alignment = .centerY
        stack.spacing = 5

        super.init(content: stack, palette: palette)

        NSLayoutConstraint.activate([
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
            icon.widthAnchor.constraint(equalToConstant: 16)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// The palette has no per-language "brand color" role, so these map onto the
    /// nearest status role the same way `SwiftUIPalette.color(named:)` does.
    private static func iconColor(for node: FileTreeNode, palette: SemanticPalette) -> NSColor {
        if node.isPackage { return palette.nsColor(.warning) }
        if node.isDirectory {
            return palette.nsColor(node.name == ".claude" ? .info : .accent)
        }
        switch node.url.pathExtension.lowercased() {
        case "swift", "json":
            return palette.nsColor(.warning)
        case "md", "markdown":
            return palette.nsColor(.accent)
        default:
            return palette.nsColor(.secondaryText)
        }
    }
}
