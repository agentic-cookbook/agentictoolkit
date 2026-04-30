import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

import AppKit

/// Terminal profiles settings: split layout with profile list (left) and detail (right).
/// Built-in profiles are read-only but can be duplicated. Custom profiles are editable and deletable.
public final class TerminalSessionProfilesSettingsView: NSView, NSTableViewDataSource, NSTableViewDelegate, NSSplitViewDelegate {

    private var profiles: [TerminalSessionProfile] = TerminalSessionProfile.builtInProfiles()
    private var selectedProfileIndex: Int? {
        didSet { updateDetail() }
    }

    private let splitView = NSSplitView()
    private let profileTable = NSTableView()
    private let detailContainer = NSView()
    private let duplicateButton = NSButton()
    private let deleteButton = NSButton()

    // Detail controls
    private let nameField = NSTextField()
    private let nameLabel = NSTextField(labelWithString: "")
    private let appearancePopUp = NSPopUpButton()
    private let fontNameLabel = NSTextField(labelWithString: "")
    private let fontSizeStepper = NSStepper()
    private let fontSizeLabel = NSTextField(labelWithString: "")
    private let cursorPopUp = NSPopUpButton()
    private let colorPreviewView = NSView()

    public override init(frame: NSRect) {
        super.init(frame: frame)
        setupViews()
        selectInitialProfile()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.delegate = self
        splitView.translatesAutoresizingMaskIntoConstraints = false

        let listPane = makeListPane()
        let detailPane = makeDetailPane()

        splitView.addSubview(listPane)
        splitView.addSubview(detailPane)
        splitView.adjustSubviews()

        addSubview(splitView)
        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: topAnchor),
            splitView.leadingAnchor.constraint(equalTo: leadingAnchor),
            splitView.trailingAnchor.constraint(equalTo: trailingAnchor),
            splitView.bottomAnchor.constraint(equalTo: bottomAnchor),
            splitView.heightAnchor.constraint(greaterThanOrEqualToConstant: 400)
        ])
        splitView.setPosition(160, ofDividerAt: 0)
    }

    public override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        guard window != nil else { return }
        // Reload once the view is in a window so the table has proper geometry
        profileTable.reloadData()
        selectInitialProfile()
    }

    private func selectInitialProfile() {
        let activeID = UserDefaults.standard.string(forKey: "terminal.activeProfileID")
            ?? TerminalSessionProfile.defaultProfileID
        if let uuid = UUID(uuidString: activeID),
           let index = profiles.firstIndex(where: { $0.id == uuid }) {
            selectedProfileIndex = index
            profileTable.selectRowIndexes(IndexSet(integer: index), byExtendingSelection: false)
        } else {
            selectedProfileIndex = 0
            profileTable.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
        }
    }

    // MARK: - List Pane

    private func makeListPane() -> NSView {
        let pane = NSView()
        pane.translatesAutoresizingMaskIntoConstraints = false
        pane.widthAnchor.constraint(greaterThanOrEqualToConstant: 140).isActive = true
        pane.widthAnchor.constraint(lessThanOrEqualToConstant: 200).isActive = true

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ProfileColumn"))
        column.resizingMask = .autoresizingMask
        profileTable.addTableColumn(column)
        profileTable.headerView = nil
        profileTable.dataSource = self
        profileTable.delegate = self
        profileTable.rowSizeStyle = .custom

        let scrollView = NSScrollView()
        scrollView.documentView = profileTable
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        duplicateButton.image = NSImage(systemSymbolName: "plus", accessibilityDescription: "Duplicate")
        duplicateButton.bezelStyle = .accessoryBarAction
        duplicateButton.isBordered = false
        duplicateButton.target = self
        duplicateButton.action = #selector(duplicateProfile)
        duplicateButton.toolTip = "Duplicate Profile"

        deleteButton.image = NSImage(systemSymbolName: "minus", accessibilityDescription: "Delete")
        deleteButton.bezelStyle = .accessoryBarAction
        deleteButton.isBordered = false
        deleteButton.target = self
        deleteButton.action = #selector(deleteProfile)
        deleteButton.toolTip = "Delete Profile"
        deleteButton.isEnabled = false

        let bottomBar = NSStackView(views: [duplicateButton, deleteButton])
        bottomBar.orientation = .horizontal
        bottomBar.spacing = 4
        bottomBar.translatesAutoresizingMaskIntoConstraints = false

        pane.addSubview(scrollView)
        pane.addSubview(bottomBar)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: pane.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: pane.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: pane.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomBar.topAnchor, constant: -4),

            bottomBar.leadingAnchor.constraint(equalTo: pane.leadingAnchor, constant: 6),
            bottomBar.bottomAnchor.constraint(equalTo: pane.bottomAnchor, constant: -6)
        ])

        return pane
    }

    // MARK: - Detail Pane

    private func makeDetailPane() -> NSView {
        let pane = NSView()
        pane.translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)

        // General section
        nameField.translatesAutoresizingMaskIntoConstraints = false
        nameField.widthAnchor.constraint(greaterThanOrEqualToConstant: 150).isActive = true
        nameField.target = self
        nameField.action = #selector(nameChanged)

        nameLabel.translatesAutoresizingMaskIntoConstraints = false

        // Stack both name controls — only one is visible at a time
        let nameContainer = NSView()
        nameContainer.translatesAutoresizingMaskIntoConstraints = false
        nameContainer.addSubview(nameField)
        nameContainer.addSubview(nameLabel)
        NSLayoutConstraint.activate([
            nameField.topAnchor.constraint(equalTo: nameContainer.topAnchor),
            nameField.leadingAnchor.constraint(equalTo: nameContainer.leadingAnchor),
            nameField.trailingAnchor.constraint(equalTo: nameContainer.trailingAnchor),
            nameField.bottomAnchor.constraint(equalTo: nameContainer.bottomAnchor),
            nameLabel.topAnchor.constraint(equalTo: nameContainer.topAnchor),
            nameLabel.leadingAnchor.constraint(equalTo: nameContainer.leadingAnchor),
            nameLabel.trailingAnchor.constraint(equalTo: nameContainer.trailingAnchor),
            nameLabel.bottomAnchor.constraint(equalTo: nameContainer.bottomAnchor)
        ])

        appearancePopUp.removeAllItems()
        for appearance in TerminalSessionProfileAppearance.allCases {
            appearancePopUp.addItem(withTitle: appearance.rawValue.capitalized)
            appearancePopUp.lastItem?.representedObject = appearance
        }
        appearancePopUp.target = self
        appearancePopUp.action = #selector(appearanceChanged)

        let generalSection = makeSection("General", rows: [
            makeLabeledRow("Name:", control: nameContainer),
            makeLabeledRow("Appearance:", control: appearancePopUp)
        ])
        stack.addArrangedSubview(generalSection)

        // Font section
        fontNameLabel.textColor = .secondaryLabelColor

        fontSizeStepper.minValue = 8
        fontSizeStepper.maxValue = 72
        fontSizeStepper.increment = 1
        fontSizeStepper.target = self
        fontSizeStepper.action = #selector(fontSizeChanged)

        let fontSizeRow = NSStackView(views: [fontSizeLabel, fontSizeStepper])
        fontSizeRow.orientation = .horizontal
        fontSizeRow.spacing = 4

        let fontSection = makeSection("Font", rows: [
            makeLabeledRow("Name:", control: fontNameLabel),
            makeLabeledRow("Size:", control: fontSizeRow)
        ])
        stack.addArrangedSubview(fontSection)

        // Cursor section
        cursorPopUp.removeAllItems()
        for style in TerminalSessionCursorStyle.allCases {
            cursorPopUp.addItem(withTitle: style.label)
            cursorPopUp.lastItem?.representedObject = style
        }
        cursorPopUp.target = self
        cursorPopUp.action = #selector(cursorChanged)

        let cursorSection = makeSection("Cursor", rows: [
            makeLabeledRow("Style:", control: cursorPopUp)
        ])
        stack.addArrangedSubview(cursorSection)

        // Colors section
        colorPreviewView.translatesAutoresizingMaskIntoConstraints = false
        let colorSection = makeSection("Colors", rows: [colorPreviewView])
        stack.addArrangedSubview(colorSection)

        pane.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: pane.topAnchor),
            stack.leadingAnchor.constraint(equalTo: pane.leadingAnchor),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: pane.trailingAnchor)
        ])

        return pane
    }

    // MARK: - Layout Helpers

    private func makeSection(_ title: String, rows: [NSView]) -> NSView {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 6

        let header = NSTextField(labelWithString: title)
        header.font = .boldSystemFont(ofSize: NSFont.systemFontSize)
        stack.addArrangedSubview(header)
        for row in rows { stack.addArrangedSubview(row) }
        return stack
    }

    private func makeLabeledRow(_ label: String, control: NSView) -> NSView {
        let labelField = NSTextField(labelWithString: label)
        labelField.alignment = .right
        labelField.translatesAutoresizingMaskIntoConstraints = false
        labelField.widthAnchor.constraint(equalToConstant: 90).isActive = true

        let row = NSStackView(views: [labelField, control])
        row.orientation = .horizontal
        row.spacing = 8
        row.alignment = .firstBaseline
        return row
    }

    // MARK: - NSTableViewDataSource

    public func numberOfRows(in tableView: NSTableView) -> Int { profiles.count }

    // MARK: - NSTableViewDelegate

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row < profiles.count else { return nil }
        let profile = profiles[row]

        let cellID = NSUserInterfaceItemIdentifier("ProfileCell")
        let cell = tableView.makeView(withIdentifier: cellID, owner: nil) as? NSTableCellView
            ?? NSTableCellView()
        cell.identifier = cellID
        cell.subviews.forEach { $0.removeFromSuperview() }

        // Color dot
        let dot = NSView()
        dot.wantsLayer = true
        dot.layer?.cornerRadius = 6
        dot.layer?.backgroundColor = (NSColor(hex: profile.colors.background) ?? .gray).cgColor
        dot.layer?.borderWidth = 0.5
        dot.layer?.borderColor = NSColor.separatorColor.cgColor
        dot.translatesAutoresizingMaskIntoConstraints = false

        // Name
        let nameLabel = NSTextField(labelWithString: profile.name)
        nameLabel.lineBreakMode = .byTruncatingTail
        nameLabel.translatesAutoresizingMaskIntoConstraints = false

        // Appearance badge (D/L/A)
        let badge = NSTextField(labelWithString: profile.appearance.rawValue.prefix(1).uppercased())
        badge.font = .boldSystemFont(ofSize: NSFont.smallSystemFontSize)
        badge.textColor = .secondaryLabelColor
        badge.translatesAutoresizingMaskIntoConstraints = false

        cell.addSubview(dot)
        cell.addSubview(nameLabel)
        cell.addSubview(badge)

        NSLayoutConstraint.activate([
            dot.widthAnchor.constraint(equalToConstant: 12),
            dot.heightAnchor.constraint(equalToConstant: 12),
            dot.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 6),
            dot.centerYAnchor.constraint(equalTo: cell.centerYAnchor),

            nameLabel.leadingAnchor.constraint(equalTo: dot.trailingAnchor, constant: 8),
            nameLabel.centerYAnchor.constraint(equalTo: cell.centerYAnchor),

            badge.leadingAnchor.constraint(greaterThanOrEqualTo: nameLabel.trailingAnchor, constant: 4),
            badge.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -6),
            badge.centerYAnchor.constraint(equalTo: cell.centerYAnchor)
        ])

        return cell
    }

    public func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat { 28 }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        let row = profileTable.selectedRow
        guard row >= 0, row < profiles.count else {
            selectedProfileIndex = nil
            return
        }
        selectedProfileIndex = row
        UserDefaults.standard.set(profiles[row].id.uuidString, forKey: "terminal.activeProfileID")
        NotificationCenter.default.post(name: TerminalSessionProfile.didChangeNotification, object: nil)
    }

    // MARK: - NSSplitViewDelegate

    public func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMinimumPosition: CGFloat,
                   ofSubviewAt dividerIndex: Int) -> CGFloat { 140 }

    public func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMaximumPosition: CGFloat,
                   ofSubviewAt dividerIndex: Int) -> CGFloat { 200 }

    // MARK: - Detail Updates

    private func updateDetail() {
        guard let index = selectedProfileIndex, index < profiles.count else { return }
        let profile = profiles[index]

        let isDeletable = profile.isDeletable
        nameField.isHidden = !isDeletable
        nameLabel.isHidden = isDeletable
        if isDeletable {
            nameField.stringValue = profile.name
        } else {
            nameLabel.stringValue = profile.name
        }

        for (i, item) in appearancePopUp.itemArray.enumerated() {
            if item.representedObject as? TerminalSessionProfileAppearance == profile.appearance {
                appearancePopUp.selectItem(at: i)
                break
            }
        }

        fontNameLabel.stringValue = profile.fontName
        fontSizeStepper.doubleValue = profile.fontSize
        fontSizeLabel.stringValue = "\(Int(profile.fontSize)) pt"

        for (i, item) in cursorPopUp.itemArray.enumerated() {
            if item.representedObject as? TerminalSessionCursorStyle == profile.cursorStyle {
                cursorPopUp.selectItem(at: i)
                break
            }
        }

        deleteButton.isEnabled = isDeletable
        updateColorPreview(profile: profile)
    }

    // MARK: - Color Preview

    private func updateColorPreview(profile: TerminalSessionProfile) {
        colorPreviewView.subviews.forEach { $0.removeFromSuperview() }

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false

        // Main color swatches
        let swatchRow = NSStackView()
        swatchRow.orientation = .horizontal
        swatchRow.spacing = 8
        swatchRow.addArrangedSubview(makeColorSwatch("FG", hex: profile.colors.foreground))
        swatchRow.addArrangedSubview(makeColorSwatch("BG", hex: profile.colors.background))
        swatchRow.addArrangedSubview(makeColorSwatch("Cursor", hex: profile.colors.cursor))
        swatchRow.addArrangedSubview(makeColorSwatch("Sel", hex: profile.colors.selection))
        stack.addArrangedSubview(swatchRow)

        // ANSI colors
        let ansiLabel = NSTextField(labelWithString: "ANSI Colors")
        ansiLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        ansiLabel.textColor = .secondaryLabelColor
        stack.addArrangedSubview(ansiLabel)

        let normalRow = NSStackView()
        normalRow.orientation = .horizontal
        normalRow.spacing = 4
        for i in 0..<min(8, profile.colors.ansi.count) {
            normalRow.addArrangedSubview(makeAnsiSwatch(hex: profile.colors.ansi[i], index: i))
        }
        stack.addArrangedSubview(normalRow)

        let brightRow = NSStackView()
        brightRow.orientation = .horizontal
        brightRow.spacing = 4
        for i in 8..<min(16, profile.colors.ansi.count) {
            brightRow.addArrangedSubview(makeAnsiSwatch(hex: profile.colors.ansi[i], index: i))
        }
        stack.addArrangedSubview(brightRow)

        // Terminal preview
        stack.addArrangedSubview(makeTerminalPreview(profile: profile))

        colorPreviewView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: colorPreviewView.topAnchor),
            stack.leadingAnchor.constraint(equalTo: colorPreviewView.leadingAnchor),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: colorPreviewView.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: colorPreviewView.bottomAnchor)
        ])
    }

    private func makeColorSwatch(_ label: String, hex: String) -> NSView {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 2
        stack.alignment = .centerX

        let swatch = NSView()
        swatch.wantsLayer = true
        swatch.layer?.cornerRadius = 4
        swatch.layer?.backgroundColor = (NSColor(hex: hex) ?? .gray).cgColor
        swatch.layer?.borderWidth = 0.5
        swatch.layer?.borderColor = NSColor.separatorColor.cgColor
        swatch.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            swatch.widthAnchor.constraint(equalToConstant: 36),
            swatch.heightAnchor.constraint(equalToConstant: 24)
        ])

        let labelField = NSTextField(labelWithString: label)
        labelField.font = .systemFont(ofSize: 9)
        labelField.textColor = .secondaryLabelColor

        stack.addArrangedSubview(swatch)
        stack.addArrangedSubview(labelField)
        return stack
    }

    private func makeAnsiSwatch(hex: String, index: Int) -> NSView {
        let swatch = NSView()
        swatch.wantsLayer = true
        swatch.layer?.cornerRadius = 3
        swatch.layer?.backgroundColor = (NSColor(hex: hex) ?? .gray).cgColor
        swatch.layer?.borderWidth = 0.5
        swatch.layer?.borderColor = NSColor.separatorColor.cgColor
        swatch.translatesAutoresizingMaskIntoConstraints = false
        swatch.toolTip = "ANSI \(index)"
        NSLayoutConstraint.activate([
            swatch.widthAnchor.constraint(equalToConstant: 24),
            swatch.heightAnchor.constraint(equalToConstant: 24)
        ])
        return swatch
    }

    private func makeTerminalPreview(profile: TerminalSessionProfile) -> NSView {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 2

        let previewLabel = NSTextField(labelWithString: "Preview")
        previewLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        previewLabel.textColor = .secondaryLabelColor
        stack.addArrangedSubview(previewLabel)

        let bgColor = NSColor(hex: profile.colors.background) ?? .black
        let fgColor = NSColor(hex: profile.colors.foreground) ?? .white
        let blueColor = profile.colors.ansi.count > 4
            ? (NSColor(hex: profile.colors.ansi[4]) ?? .systemBlue)
            : .systemBlue

        let monoFont = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)

        let previewBox = NSView()
        previewBox.wantsLayer = true
        previewBox.layer?.cornerRadius = 6
        previewBox.layer?.backgroundColor = bgColor.cgColor
        previewBox.translatesAutoresizingMaskIntoConstraints = false

        let line1 = NSTextField(labelWithString: "user@mac ~ % ls")
        line1.font = monoFont
        line1.textColor = fgColor
        line1.translatesAutoresizingMaskIntoConstraints = false

        let docsLabel = NSTextField(labelWithString: "Documents")
        docsLabel.font = monoFont
        docsLabel.textColor = blueColor

        let readmeLabel = NSTextField(labelWithString: "README.md")
        readmeLabel.font = monoFont
        readmeLabel.textColor = fgColor

        let line2 = NSStackView(views: [docsLabel, readmeLabel])
        line2.orientation = .horizontal
        line2.spacing = 8
        line2.translatesAutoresizingMaskIntoConstraints = false

        previewBox.addSubview(line1)
        previewBox.addSubview(line2)

        NSLayoutConstraint.activate([
            previewBox.widthAnchor.constraint(greaterThanOrEqualToConstant: 250),
            previewBox.heightAnchor.constraint(equalToConstant: 50),

            line1.topAnchor.constraint(equalTo: previewBox.topAnchor, constant: 8),
            line1.leadingAnchor.constraint(equalTo: previewBox.leadingAnchor, constant: 8),

            line2.topAnchor.constraint(equalTo: line1.bottomAnchor, constant: 1),
            line2.leadingAnchor.constraint(equalTo: previewBox.leadingAnchor, constant: 8)
        ])

        stack.addArrangedSubview(previewBox)
        return stack
    }

    // MARK: - Actions

    @objc private func nameChanged() {
        guard let index = selectedProfileIndex, profiles[index].isDeletable else { return }
        profiles[index].name = nameField.stringValue
        profileTable.reloadData()
    }

    @objc private func appearanceChanged() {
        guard let index = selectedProfileIndex,
              let appearance = appearancePopUp.selectedItem?.representedObject as? TerminalSessionProfileAppearance else { return }
        profiles[index].appearance = appearance
        profileTable.reloadData(forRowIndexes: IndexSet(integer: index), columnIndexes: IndexSet(integer: 0))
    }

    @objc private func fontSizeChanged() {
        guard let index = selectedProfileIndex else { return }
        profiles[index].fontSize = fontSizeStepper.doubleValue
        fontSizeLabel.stringValue = "\(Int(fontSizeStepper.doubleValue)) pt"
    }

    @objc private func cursorChanged() {
        guard let index = selectedProfileIndex,
              let style = cursorPopUp.selectedItem?.representedObject as? TerminalSessionCursorStyle else { return }
        profiles[index].cursorStyle = style
    }

    @objc private func duplicateProfile() {
        guard let index = selectedProfileIndex else { return }
        let source = profiles[index]
        let copy = TerminalSessionProfile(
            id: UUID(), name: "\(source.name) Copy",
            appearance: source.appearance, fontName: source.fontName,
            fontSize: source.fontSize, cursorStyle: source.cursorStyle,
            colors: source.colors, isDeletable: true
        )
        profiles.append(copy)
        profileTable.reloadData()
        let newIndex = profiles.count - 1
        profileTable.selectRowIndexes(IndexSet(integer: newIndex), byExtendingSelection: false)
    }

    @objc private func deleteProfile() {
        guard let index = selectedProfileIndex, profiles[index].isDeletable else { return }
        profiles.remove(at: index)
        profileTable.reloadData()
        let newIndex = min(index, profiles.count - 1)
        if newIndex >= 0 {
            profileTable.selectRowIndexes(IndexSet(integer: newIndex), byExtendingSelection: false)
        }
    }
}
