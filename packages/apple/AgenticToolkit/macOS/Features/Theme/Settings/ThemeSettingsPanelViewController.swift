import AppKit
import AgenticToolkitCore

/// The "Theme" settings panel — a topic/detail split (like "Claude"/"AI") with
/// one sub-panel per theme. The sidebar lists the themes (name + color swatch);
/// selecting one activates it and shows its preview + editor in the detail. The
/// list is user-resizable via the split's draggable divider.
@MainActor
public final class ThemeSettingsPanelViewController: ComposableSettings.SettingsPanelSplitViewController {

    private let store = ThemeStore()

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Theme",
            icon: NSImage(systemSymbolName: "paintpalette", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        rebuildPanels(selecting: UserSettings.activeThemeID.value)
    }

    /// Rebuilds one detail panel per theme and selects `selectID` (the active
    /// theme, or a freshly imported/duplicated one). Called on load and after any
    /// structural change to the theme list.
    private func rebuildPanels(selecting selectID: String?) {
        let themes = store.allThemes
        let panels = themes.map { theme in
            ThemeDetailPanelViewController(
                theme: theme,
                store: store,
                onStructuralChange: { [weak self] id in self?.rebuildPanels(selecting: id) },
                onRowInvalidated: { [weak self] in self?.refreshRows() }
            )
        }
        setPanels(panels)
        let targetID = selectID ?? themes.first?.id
        if let index = themes.firstIndex(where: { $0.id == targetID }) {
            selectPanel(at: index)
        } else if !panels.isEmpty {
            selectPanel(at: 0)
        }
    }

    /// Re-reads the sidebar rows (titles/swatches) from the existing panels after
    /// an in-place edit (a rename), without recreating them or re-showing the
    /// detail, then keeps the active theme's row highlighted.
    private func refreshRows() {
        listViewController.setPanels(panels)
        let activeID = UserSettings.activeThemeID.value
        if let index = panels.firstIndex(where: { ($0 as? ThemeDetailPanelViewController)?.themeID == activeID }) {
            listViewController.selectPanel(at: index)
        }
    }
}
