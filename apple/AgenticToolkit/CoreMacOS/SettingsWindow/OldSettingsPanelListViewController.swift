import AppKit

/// Sidebar list of settings panels. Subclass of `TopicListViewController` that
/// maps `[OldSettingsPanelViewController]` to `TopicListSection`s and translates
/// row selection back to the owning panel. Open so client apps can customize
/// row presentation or add secondary actions.
@MainActor
open class OldSettingsPanelListViewController: TopicListViewController {

    /// Fired when the user picks a row. Nil when nothing is selected.
    public var onSelectPanel: ((OldSettingsPanelViewController?) -> Void)?

    private var panels: [OldSettingsPanelViewController] = []

    public override init(nibName: NSNib.Name?, bundle: Bundle?) {
        super.init(nibName: nibName, bundle: bundle)
        // onSelect is a superclass implementation hook owned by this subclass;
        // external consumers should use `onSelectPanel`.
        onSelect = { [weak self] item in
            guard let self else { return }
            self.onSelectPanel?(item.flatMap { self.panel(forId: $0.id) })
        }
    }

    public required init?(coder: NSCoder) { super.init(coder: coder) }

    public func setPanels(_ panels: [OldSettingsPanelViewController]) {
        self.panels = panels
        setSections(Self.buildSections(from: panels))
    }

    /// Selects the row at `index` without firing `onSelectPanel`, since
    /// programmatic selection flows through `OldSettingsViewController.selectPanel`.
    public func selectPanel(at index: Int) {
        guard panels.indices.contains(index) else { return }
        selectItem(withId: String(index))
    }

    // MARK: - Internals

    private func panel(forId id: String) -> OldSettingsPanelViewController? {
        guard let index = Int(id), panels.indices.contains(index) else { return nil }
        return panels[index]
    }

    private static func buildSections(from panels: [OldSettingsPanelViewController]) -> [TopicListSection] {
        let items = panels.enumerated().map { index, panel in
            TopicListItem(id: String(index), title: panel.panelTitle, icon: panel.icon)
        }

        let hasSections = panels.contains { $0.section != nil }
        guard hasSections else {
            return [TopicListSection(title: nil, items: items)]
        }

        var leading: [TopicListItem] = []
        var ordered: [String] = []
        var grouped: [String: [TopicListItem]] = [:]
        for (index, panel) in panels.enumerated() {
            guard let section = panel.section else {
                leading.append(items[index])
                continue
            }
            if grouped[section] == nil {
                ordered.append(section)
                grouped[section] = []
            }
            grouped[section]?.append(items[index])
        }

        var sections: [TopicListSection] = []
        if !leading.isEmpty {
            sections.append(TopicListSection(title: nil, items: leading))
        }
        for title in ordered {
            sections.append(TopicListSection(title: title, items: grouped[title] ?? []))
        }
        return sections
    }
}
