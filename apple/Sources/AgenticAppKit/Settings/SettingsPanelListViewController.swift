import AppKit

/// Sidebar list of settings panel entries. Internal to the Settings subsystem;
/// callers never touch this directly — they work with `SettingsViewController`.
@MainActor
final class SettingsPanelListViewController: NSViewController {

    var onSelect: ((any SettingsPanelViewController)?) -> Void = { _ in }

    private var panels: [any SettingsPanelViewController] = []
    private let tableView = NSTableView()
    private let scrollView = NSScrollView()

    override func loadView() {
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("panel"))
        column.title = ""
        tableView.addTableColumn(column)
        tableView.headerView = nil
        tableView.style = .sourceList
        tableView.rowHeight = 28
        tableView.dataSource = self
        tableView.delegate = self

        scrollView.documentView = tableView
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        self.view = scrollView
    }

    func setPanels(_ panels: [any SettingsPanelViewController]) {
        self.panels = panels
        tableView.reloadData()
    }

    /// Selects the row at `index` without triggering the `onSelect` callback,
    /// since programmatic selection flows through `SettingsViewController.selectPanel`.
    func selectRow(_ index: Int) {
        guard index >= 0, index < panels.count else { return }
        tableView.selectRowIndexes(IndexSet(integer: index), byExtendingSelection: false)
    }
}

extension SettingsPanelListViewController: NSTableViewDataSource, NSTableViewDelegate {

    func numberOfRows(in tableView: NSTableView) -> Int { panels.count }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row >= 0, row < panels.count else { return nil }
        let item = panels[row].listItem

        let identifier = NSUserInterfaceItemIdentifier("PanelRow")
        let cell = tableView.makeView(withIdentifier: identifier, owner: nil) as? NSTableCellView ?? {
            let c = NSTableCellView()
            c.identifier = identifier
            let imageView = NSImageView()
            imageView.translatesAutoresizingMaskIntoConstraints = false
            let textField = NSTextField(labelWithString: "")
            textField.translatesAutoresizingMaskIntoConstraints = false
            c.addSubview(imageView)
            c.addSubview(textField)
            c.imageView = imageView
            c.textField = textField
            NSLayoutConstraint.activate([
                imageView.leadingAnchor.constraint(equalTo: c.leadingAnchor, constant: 4),
                imageView.centerYAnchor.constraint(equalTo: c.centerYAnchor),
                imageView.widthAnchor.constraint(equalToConstant: 16),
                imageView.heightAnchor.constraint(equalToConstant: 16),
                textField.leadingAnchor.constraint(equalTo: imageView.trailingAnchor, constant: 6),
                textField.centerYAnchor.constraint(equalTo: c.centerYAnchor),
                textField.trailingAnchor.constraint(lessThanOrEqualTo: c.trailingAnchor, constant: -4),
            ])
            return c
        }()

        cell.textField?.stringValue = item.title
        cell.textField?.font = .systemFont(ofSize: 13)
        cell.imageView?.image = item.image
        return cell
    }

    func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        onSelect(row >= 0 && row < panels.count ? panels[row] : nil)
    }
}
