import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// One theme's detail pane in the Theme settings split: two tabs, **Preview**
/// and **Edit**.
///
/// Preview is the theme rendered onto sample app chrome — the point of a theme
/// is what it looks like, so that is what opens first. Edit is a topic list
/// (Details, Colors, Project, Typography, Terminal) over the same theme; for a
/// locked theme (built-in or imported) its controls are read-only and the
/// Details topic explains why.
///
/// Selecting the panel's row in the sidebar activates the theme app-wide, so
/// the window around the editor is itself the truest preview. Structural
/// actions (add / remove / duplicate / import / export) live in the sidebar
/// footer, not here; a rename calls `onRowInvalidated` so the sidebar row
/// re-reads its title and swatch without tearing the editor down.
@MainActor
final class ThemeDetailPanelViewController: ComposableSettings.SettingsPanelViewController,
                                            NSTabViewDelegate {

    private enum Tab: String {
        case preview, edit
    }

    private let context: ThemeEditorContext
    private let onRowInvalidated: () -> Void

    /// The theme this panel edits, for the parent split's selection bookkeeping.
    var themeID: String { context.theme.id }

    private let preview = ComposableSettings.ThemePreviewView()
    private let tabView = NSTabView()
    private lazy var editor = ThemeEditorSplitViewController(
        context: context,
        onRenamed: { [weak self] name in self?.themeWasRenamed(to: name) }
    )

    /// Coalesces the expensive global side effects of an edit (see `themeDidChange`).
    private var pendingRefresh: DispatchWorkItem?

    init(theme: ColorTheme,
         store: ThemeStore,
         onRowInvalidated: @escaping () -> Void) {
        self.context = ThemeEditorContext(theme: theme, store: store)
        self.onRowInvalidated = onRowInvalidated
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: theme.name,
            icon: Self.swatch(for: theme)))
        self.context.onEdit = { [weak self] updated in self?.themeDidChange(updated) }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// The tabs own their own scrolling — the preview scrolls, and the editor
    /// split scrolls inside its own detail pane — so the settings split must not
    /// wrap the whole thing in a second scroll view.
    override var hostsOwnScroll: Bool { true }

    override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Preview and Edit",
                body: "Preview shows the theme drawn onto sample app chrome and a sample "
                    + "terminal, so you can judge it before committing to it. Edit is where "
                    + "it is changed, one topic at a time."
            ),
            .init(
                title: "Editing Is Live",
                body: "Selecting a theme in the list makes it active, and every change lands "
                    + "immediately — there is no Save and no Revert. So the settings window "
                    + "around you re-themes as you work, which is the honest preview."
            )
        ])
    }

    /// The reader is looking at whichever tab is showing, and inside Edit at
    /// whichever topic is selected — so that is what the drawer answers with.
    override var effectiveHelpContent: ComposableSettings.PanelHelp? {
        guard selectedTab == .edit else { return helpContent }
        return editor.effectiveHelp ?? helpContent
    }

    private var selectedTab: Tab {
        guard let identifier = tabView.selectedTabViewItem?.identifier as? String else { return .preview }
        return Tab(rawValue: identifier) ?? .preview
    }

    // MARK: - View

    override func loadView() {
        addChild(editor)

        let previewItem = NSTabViewItem(identifier: Tab.preview.rawValue)
        previewItem.label = "Preview"
        previewItem.view = makePreviewTab()

        let editItem = NSTabViewItem(identifier: Tab.edit.rawValue)
        editItem.label = "Edit"
        editItem.view = editor.view

        tabView.translatesAutoresizingMaskIntoConstraints = false
        tabView.addTabViewItem(previewItem)
        tabView.addTabViewItem(editItem)
        tabView.delegate = self

        let container = ThemedBackgroundView(role: .windowBackground)
        container.addSubview(tabView)
        NSLayoutConstraint.activate([
            tabView.topAnchor.constraint(equalTo: container.topAnchor, constant: 12),
            tabView.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),
            tabView.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -12),
            tabView.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -12)
        ])
        self.view = container
    }

    /// The preview scrolls: the chrome sample, the swatch grid and the terminal
    /// sample together are taller than a short settings window.
    private func makePreviewTab() -> NSView {
        preview.show(context.theme)
        preview.wantsLayer = true
        preview.layer?.cornerRadius = 10
        preview.layer?.masksToBounds = true
        preview.translatesAutoresizingMaskIntoConstraints = false

        let doc = ThemeFlippedView()
        doc.translatesAutoresizingMaskIntoConstraints = false
        doc.addSubview(preview)

        let scroll = NSScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.drawsBackground = false
        scroll.documentView = doc

        let clip = scroll.contentView
        NSLayoutConstraint.activate([
            doc.topAnchor.constraint(equalTo: clip.topAnchor),
            doc.leadingAnchor.constraint(equalTo: clip.leadingAnchor),
            doc.widthAnchor.constraint(equalTo: clip.widthAnchor),

            preview.topAnchor.constraint(equalTo: doc.topAnchor, constant: 12),
            preview.leadingAnchor.constraint(equalTo: doc.leadingAnchor, constant: 12),
            preview.trailingAnchor.constraint(equalTo: doc.trailingAnchor, constant: -12),
            preview.bottomAnchor.constraint(equalTo: doc.bottomAnchor, constant: -16)
        ])
        return scroll
    }

    /// Selecting a theme row activates it app-wide.
    override func viewWillAppear() {
        super.viewWillAppear()
        if let manager = ThemeManager.shared {
            manager.selectTheme(id: context.theme.id)
        } else {
            UserSettings.activeThemeID.value = context.theme.id
        }
    }

    // MARK: - NSTabViewDelegate

    func tabView(_ tabView: NSTabView, didSelect tabViewItem: NSTabViewItem?) {
        // Preview and Edit describe different things, so the drawer has to follow
        // the tab; only the outermost split has a presenter to tell.
        enclosingSettingsSplit?.refreshHelp()
    }

    // MARK: - Edits

    private func themeWasRenamed(to name: String) {
        descriptor.title = name
        // The sidebar row snapshots its title once; re-read it after a rename.
        onRowInvalidated()
    }

    private func themeDidChange(_ updated: ColorTheme) {
        // Keep the in-panel preview live every tick (cheap and local).
        preview.show(updated)
        // Coalesce the expensive, purely-cosmetic global work — the app-wide
        // re-theme and the sidebar swatch refresh — so dragging a color well
        // doesn't repaint every window and rebuild the sidebar on every tick.
        pendingRefresh?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.applyGlobalRefresh(updated) }
        pendingRefresh = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: work)
    }

    /// The debounced tail of `themeDidChange`: refresh the sidebar swatch and
    /// re-apply the theme app-wide once edits settle. Safe to skip if the panel
    /// is torn down first — a structural rebuild re-themes and re-reads the
    /// swatch anyway.
    private func applyGlobalRefresh(_ updated: ColorTheme) {
        descriptor.icon = Self.swatch(for: updated)
        onRowInvalidated()
        if UserSettings.activeThemeID.value == updated.id, let manager = ThemeManager.shared {
            manager.selectTheme(id: updated.id)
        }
    }

    // MARK: - Sidebar swatch

    /// A small color chip for the sidebar row: the theme's background with an
    /// accent dot, so themes are recognizable at a glance. Locked themes
    /// (built-in or imported) also get a small lock badge in the corner.
    private static func swatch(for theme: ColorTheme) -> NSImage {
        let size = NSSize(width: 22, height: 16)
        let image = NSImage(size: size, flipped: false) { rect in
            let body = rect.insetBy(dx: 1, dy: 1)
            let path = NSBezierPath(roundedRect: body, xRadius: 4, yRadius: 4)
            NSColor(theme.background).setFill()
            path.fill()
            // The swatch's *contents* are the theme being previewed; its outline is
            // sidebar chrome, so it comes from the active theme like the rest.
            ThemePaletteObserver.currentPalette.nsColor(.divider).setStroke()
            path.lineWidth = 1
            path.stroke()
            let palette = SemanticPalette(theme: theme)
            NSColor(palette.color(.accent)).setFill()
            NSBezierPath(ovalIn: NSRect(x: body.minX + 4, y: body.midY - 3, width: 6, height: 6)).fill()
            if theme.isLocked {
                Self.drawLockBadge(in: body, foreground: NSColor(theme.foreground))
            }
            return true
        }
        image.isTemplate = false
        return image
    }

    /// Composites a lock glyph into the swatch's bottom-right corner, tinted with
    /// the theme's foreground so it reads against the theme background.
    private static func drawLockBadge(in body: NSRect, foreground: NSColor) {
        let config = NSImage.SymbolConfiguration(pointSize: 8, weight: .bold)
            .applying(NSImage.SymbolConfiguration(paletteColors: [foreground]))
        guard let lock = NSImage(systemSymbolName: "lock.fill", accessibilityDescription: "Locked")?
            .withSymbolConfiguration(config) else { return }
        let glyph = lock.size
        let rect = NSRect(x: body.maxX - glyph.width - 1, y: body.minY + 1,
                          width: glyph.width, height: glyph.height)
        lock.draw(in: rect)
    }
}
