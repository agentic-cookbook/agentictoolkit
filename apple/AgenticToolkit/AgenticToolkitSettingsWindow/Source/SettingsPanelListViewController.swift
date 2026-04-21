import AppKit
import AgenticToolkitCoreUI

/// Sidebar list of settings panel entries. Internal to the Settings subsystem;
/// callers never touch this directly — they work with `SettingsViewController`.
///
/// Backed by a `TopicListViewController`. When any panel declares
/// `listItem.section`, panels are grouped under that header in declaration
/// order; nil-section panels form a leading anonymous section. When no panel
/// declares a section, the list renders flat (today's behavior).
@MainActor
final class SettingsPanelListViewController: NSViewController {

    var onSelect: ((any SettingsPanelViewController)?) -> Void = { _ in }

    private var panels: [any SettingsPanelViewController] = []
    private let topicList = TopicListViewController()

    override func loadView() {
        topicList.onSelect = { [weak self] item in
            guard let self else { return }
            self.onSelect(item.flatMap { self.panel(forId: $0.id) })
        }
        addChild(topicList)
        self.view = topicList.view
    }

    func setPanels(_ panels: [any SettingsPanelViewController]) {
        self.panels = panels
        topicList.setSections(buildSections(from: panels))
    }

    /// Selects the row at `index` without triggering the `onSelect` callback,
    /// since programmatic selection flows through `SettingsViewController.selectPanel`.
    func selectRow(_ index: Int) {
        guard index >= 0, index < panels.count else { return }
        topicList.selectItem(withId: id(forIndex: index))
    }

    // MARK: - Mapping

    private func id(forIndex index: Int) -> String { String(index) }

    private func panel(forId id: String) -> (any SettingsPanelViewController)? {
        guard let index = Int(id), index >= 0, index < panels.count else { return nil }
        return panels[index]
    }

    private func buildSections(from panels: [any SettingsPanelViewController]) -> [TopicListSection] {
        let items = panels.enumerated().map { index, panel in
            TopicListItem(
                id: id(forIndex: index),
                title: panel.listItem.title,
                icon: panel.listItem.image
            )
        }

        let hasSections = panels.contains { $0.listItem.section != nil }
        guard hasSections else {
            return [TopicListSection(title: nil, items: items)]
        }

        var leadingItems: [TopicListItem] = []
        var orderedTitles: [String] = []
        var grouped: [String: [TopicListItem]] = [:]
        for (index, panel) in panels.enumerated() {
            guard let section = panel.listItem.section else {
                leadingItems.append(items[index])
                continue
            }
            if grouped[section] == nil {
                orderedTitles.append(section)
                grouped[section] = []
            }
            grouped[section]?.append(items[index])
        }

        var sections: [TopicListSection] = []
        if !leadingItems.isEmpty {
            sections.append(TopicListSection(title: nil, items: leadingItems))
        }
        for title in orderedTitles {
            sections.append(TopicListSection(title: title, items: grouped[title] ?? []))
        }
        return sections
    }
}
