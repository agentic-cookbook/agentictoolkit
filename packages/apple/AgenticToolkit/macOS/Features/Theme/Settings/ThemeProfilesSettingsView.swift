import AppKit
import UniformTypeIdentifiers
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Theme settings: split layout with a theme list (left) and an editor (right).
/// A superset of the terminal `TerminalSessionProfilesSettingsView` — it adds
/// editable color wells, `.itermcolors` import, real persistence (via
/// `ThemeStore`), and a live app+terminal sample (`ThemePreviewView`).
/// Selecting a theme makes it the active app theme.
public final class ThemeProfilesSettingsView: NSView, NSTableViewDataSource, NSTableViewDelegate {

    private enum Slot: Equatable {
        case foreground, background, cursor, selection, ansi(Int)
        case role(ThemeRole)
    }

    /// Semantic chrome roles exposed as editable color wells (override the
    /// derived value). Backgrounds, lines, text, and status — what users asked to
    /// theme directly.
    private static let editableRoles: [ThemeRole] = [
        .windowBackground, .surface, .elevatedSurface, .controlBackground,
        .primaryText, .secondaryText, .tertiaryText,
        .accent, .success, .warning, .danger, .info,
        .border, .outline, .divider
    ]

    private static let roleCaptions: [ThemeRole: String] = [
        .windowBackground: "Window", .surface: "Panel", .elevatedSurface: "Raised",
        .controlBackground: "Field", .primaryText: "Text", .secondaryText: "Text2",
        .tertiaryText: "Text3", .accent: "Accent", .success: "OK", .warning: "Warn",
        .danger: "Error", .info: "Info", .border: "Border", .outline: "Outline", .divider: "Divide"
    ]

    private let store = ThemeStore()
    private var themes: [ColorTheme] = []
    private var editingTheme: ColorTheme?

    private let splitView = NSSplitView()
    private let table = NSTableView()
    private let importButton = NSButton()
    private let duplicateButton = NSButton()
    private let deleteButton = NSButton()

    private let nameField = NSTextField()
    private let appearancePopUp = NSPopUpButton()
    private let preview = ComposableSettings.ThemePreviewView()
    private let wellsContainer = NSStackView()
    private var colorWells: [(slot: Slot, well: NSColorWell)] = []

    private let typographyContainer = NSStackView()
    private let scaleSlider = NSSlider(value: 1.0, minValue: 0.8, maxValue: 1.6, target: nil, action: nil)
    private let scaleLabel = NSTextField(labelWithString: "100%")
    private var sizeFields: [TextRole: NSTextField] = [:]
    private var sizeSteppers: [TextRole: NSStepper] = [:]
    private var weightPopups: [TextRole: NSPopUpButton] = [:]
    private var familyFields: [TextRole: NSTextField] = [:]

    public override init(frame: NSRect) {
        super.init(frame: frame)
        self.themes = store.allThemes
        setupViews()
        selectInitial()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    // MARK: - Setup

    private func setupViews() {
        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.translatesAutoresizingMaskIntoConstraints = false

        splitView.addSubview(makeListPane())
        splitView.addSubview(makeDetailPane())
        splitView.adjustSubviews()

        addSubview(splitView)
        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: topAnchor),
            splitView.leadingAnchor.constraint(equalTo: leadingAnchor),
            splitView.trailingAnchor.constraint(equalTo: trailingAnchor),
            splitView.bottomAnchor.constraint(equalTo: bottomAnchor),
            splitView.heightAnchor.constraint(greaterThanOrEqualToConstant: 420)
        ])
        splitView.setPosition(180, ofDividerAt: 0)
    }

    private func makeListPane() -> NSView {
        let pane = NSView()
        pane.translatesAutoresizingMaskIntoConstraints = false
        pane.widthAnchor.constraint(greaterThanOrEqualToConstant: 160).isActive = true
        pane.widthAnchor.constraint(lessThanOrEqualToConstant: 220).isActive = true

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ThemeColumn"))
        column.resizingMask = .autoresizingMask
        table.addTableColumn(column)
        table.headerView = nil
        table.dataSource = self
        table.delegate = self
        table.rowSizeStyle = .custom

        let scroll = NSScrollView()
        scroll.documentView = table
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.translatesAutoresizingMaskIntoConstraints = false

        configureBarButton(importButton, symbol: "square.and.arrow.down",
                           tooltip: "Import .itermcolors…", action: #selector(importTheme))
        configureBarButton(duplicateButton, symbol: "plus.square.on.square",
                           tooltip: "Duplicate Theme", action: #selector(duplicateTheme))
        configureBarButton(deleteButton, symbol: "minus",
                           tooltip: "Delete Theme", action: #selector(deleteTheme))
        deleteButton.isEnabled = false

        let bar = NSStackView(views: [importButton, duplicateButton, deleteButton])
        bar.orientation = .horizontal
        bar.spacing = 4
        bar.translatesAutoresizingMaskIntoConstraints = false

        pane.addSubview(scroll)
        pane.addSubview(bar)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: pane.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: pane.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: pane.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: bar.topAnchor, constant: -4),
            bar.leadingAnchor.constraint(equalTo: pane.leadingAnchor, constant: 6),
            bar.bottomAnchor.constraint(equalTo: pane.bottomAnchor, constant: -6)
        ])
        return pane
    }

    private func configureBarButton(_ button: NSButton, symbol: String, tooltip: String, action: Selector) {
        button.image = NSImage(systemSymbolName: symbol, accessibilityDescription: tooltip)
        button.bezelStyle = .accessoryBarAction
        button.isBordered = false
        button.target = self
        button.action = action
        button.toolTip = tooltip
    }

    private func makeDetailPane() -> NSView {
        let pane = NSView()
        pane.translatesAutoresizingMaskIntoConstraints = false

        nameField.translatesAutoresizingMaskIntoConstraints = false
        nameField.widthAnchor.constraint(greaterThanOrEqualToConstant: 180).isActive = true
        nameField.target = self
        nameField.action = #selector(nameChanged)

        appearancePopUp.removeAllItems()
        for appearance in ThemeAppearance.allCases {
            appearancePopUp.addItem(withTitle: appearance.rawValue.capitalized)
            appearancePopUp.lastItem?.representedObject = appearance
        }
        appearancePopUp.target = self
        appearancePopUp.action = #selector(appearanceChanged)

        wellsContainer.orientation = .vertical
        wellsContainer.alignment = .leading
        wellsContainer.spacing = 6

        typographyContainer.orientation = .vertical
        typographyContainer.alignment = .leading
        typographyContainer.spacing = 6

        let stack = NSStackView(views: [
            labeledRow("Name", nameField),
            labeledRow("Appearance", appearancePopUp),
            sectionLabel("Colors"),
            wellsContainer,
            sectionLabel("Typography"),
            typographyContainer,
            sectionLabel("Preview"),
            preview
        ])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)

        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        let doc = NSView()
        doc.translatesAutoresizingMaskIntoConstraints = false
        doc.addSubview(stack)
        scroll.documentView = doc

        pane.addSubview(scroll)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: pane.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: pane.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: pane.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: pane.bottomAnchor),
            doc.topAnchor.constraint(equalTo: scroll.topAnchor),
            doc.leadingAnchor.constraint(equalTo: scroll.leadingAnchor),
            doc.trailingAnchor.constraint(equalTo: scroll.trailingAnchor),
            doc.widthAnchor.constraint(equalTo: scroll.widthAnchor),
            stack.topAnchor.constraint(equalTo: doc.topAnchor),
            stack.leadingAnchor.constraint(equalTo: doc.leadingAnchor),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: doc.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: doc.bottomAnchor)
        ])
        return pane
    }

    // MARK: - Layout helpers

    private func sectionLabel(_ title: String) -> NSTextField {
        let label = NSTextField(labelWithString: title)
        label.font = .boldSystemFont(ofSize: NSFont.systemFontSize)
        return label
    }

    private func labeledRow(_ title: String, _ control: NSView) -> NSView {
        let label = NSTextField(labelWithString: title + ":")
        label.alignment = .right
        label.translatesAutoresizingMaskIntoConstraints = false
        label.widthAnchor.constraint(equalToConstant: 90).isActive = true
        let row = NSStackView(views: [label, control])
        row.orientation = .horizontal
        row.spacing = 8
        row.alignment = .firstBaseline
        return row
    }

    // MARK: - Selection

    private func selectInitial() {
        let activeID = UserSettings.activeThemeID.value
        let index = themes.firstIndex { $0.id == activeID } ?? 0
        if themes.indices.contains(index) {
            table.selectRowIndexes(IndexSet(integer: index), byExtendingSelection: false)
        }
    }

    private func selectTheme(id: String) {
        themes = store.allThemes
        table.reloadData()
        if let index = themes.firstIndex(where: { $0.id == id }) {
            table.selectRowIndexes(IndexSet(integer: index), byExtendingSelection: false)
        }
    }

    // MARK: - NSTableView

    public func numberOfRows(in tableView: NSTableView) -> Int { themes.count }

    public func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat { 28 }

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard themes.indices.contains(row) else { return nil }
        let theme = themes[row]
        let cell = NSTableCellView()

        let dot = NSView()
        dot.wantsLayer = true
        dot.layer?.cornerRadius = 6
        dot.layer?.backgroundColor = NSColor(theme.background).cgColor
        dot.layer?.borderWidth = 0.5
        dot.layer?.borderColor = NSColor.separatorColor.cgColor
        dot.translatesAutoresizingMaskIntoConstraints = false

        let name = NSTextField(labelWithString: theme.name)
        name.lineBreakMode = .byTruncatingTail
        name.translatesAutoresizingMaskIntoConstraints = false

        let badge = NSTextField(labelWithString: theme.appearance.rawValue.prefix(1).uppercased())
        badge.font = .boldSystemFont(ofSize: NSFont.smallSystemFontSize)
        badge.textColor = .secondaryLabelColor
        badge.translatesAutoresizingMaskIntoConstraints = false

        cell.addSubview(dot)
        cell.addSubview(name)
        cell.addSubview(badge)
        NSLayoutConstraint.activate([
            dot.widthAnchor.constraint(equalToConstant: 12),
            dot.heightAnchor.constraint(equalToConstant: 12),
            dot.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 6),
            dot.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            name.leadingAnchor.constraint(equalTo: dot.trailingAnchor, constant: 8),
            name.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            badge.leadingAnchor.constraint(greaterThanOrEqualTo: name.trailingAnchor, constant: 4),
            badge.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -6),
            badge.centerYAnchor.constraint(equalTo: cell.centerYAnchor)
        ])
        return cell
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        let row = table.selectedRow
        guard themes.indices.contains(row) else { editingTheme = nil; return }
        let theme = themes[row]
        editingTheme = theme

        // Make the selected theme the active app theme.
        if let manager = ThemeManager.shared {
            manager.selectTheme(id: theme.id)
        } else {
            UserSettings.activeThemeID.value = theme.id
        }
        updateDetail()
    }

    // MARK: - Detail

    private func updateDetail() {
        guard let theme = editingTheme else { return }
        let editable = !store.isBuiltIn(id: theme.id)

        nameField.stringValue = theme.name
        nameField.isEditable = editable
        deleteButton.isEnabled = editable

        for (index, item) in appearancePopUp.itemArray.enumerated()
        where item.representedObject as? ThemeAppearance == theme.appearance {
            appearancePopUp.selectItem(at: index)
        }
        appearancePopUp.isEnabled = editable

        rebuildWells(for: theme, editable: editable)
        rebuildTypography(for: theme, editable: editable)
        preview.show(theme)
    }

    // MARK: - Typography editor

    private func rebuildTypography(for theme: ColorTheme, editable: Bool) {
        typographyContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        sizeFields.removeAll(); sizeSteppers.removeAll()
        weightPopups.removeAll(); familyFields.removeAll()

        // Global size scale.
        scaleSlider.doubleValue = theme.typography.sizeScale
        scaleSlider.isEnabled = editable
        scaleSlider.target = self
        scaleSlider.action = #selector(scaleChanged)
        scaleSlider.translatesAutoresizingMaskIntoConstraints = false
        scaleSlider.widthAnchor.constraint(equalToConstant: 140).isActive = true
        scaleLabel.stringValue = "\(Int((theme.typography.sizeScale * 100).rounded()))%"
        let scaleRow = NSStackView(views: [captionLabel("Text size", width: 70), scaleSlider, scaleLabel])
        scaleRow.orientation = .horizontal
        scaleRow.spacing = 8
        typographyContainer.addArrangedSubview(scaleRow)

        let header = NSStackView(views: [
            captionLabel("", width: 70), captionLabel("Size", width: 70),
            captionLabel("Weight", width: 110), captionLabel("Font family", width: 140)
        ])
        header.orientation = .horizontal
        header.spacing = 8
        typographyContainer.addArrangedSubview(header)

        for role in TextRole.allCases {
            typographyContainer.addArrangedSubview(typographyRow(role, theme: theme, editable: editable))
        }
    }

    private func typographyRow(_ role: TextRole, theme: ColorTheme, editable: Bool) -> NSView {
        let style = theme.typography.style(role)
        let roleID = NSUserInterfaceItemIdentifier(role.rawValue)

        let sizeField = NSTextField()
        sizeField.doubleValue = style.size
        sizeField.identifier = roleID
        sizeField.isEditable = editable
        sizeField.target = self
        sizeField.action = #selector(typographyChanged(_:))
        sizeField.translatesAutoresizingMaskIntoConstraints = false
        sizeField.widthAnchor.constraint(equalToConstant: 44).isActive = true
        sizeFields[role] = sizeField

        let stepper = NSStepper()
        stepper.minValue = 8; stepper.maxValue = 48; stepper.increment = 1
        stepper.doubleValue = style.size
        stepper.identifier = roleID
        stepper.isEnabled = editable
        stepper.target = self
        stepper.action = #selector(sizeStepperChanged(_:))
        sizeSteppers[role] = stepper

        let weightPopup = NSPopUpButton()
        for weight in FontWeight.allCases {
            weightPopup.addItem(withTitle: weight.rawValue.capitalized)
            weightPopup.lastItem?.representedObject = weight
        }
        weightPopup.identifier = roleID
        weightPopup.isEnabled = editable
        weightPopup.target = self
        weightPopup.action = #selector(typographyChanged(_:))
        if let index = FontWeight.allCases.firstIndex(of: style.weight) { weightPopup.selectItem(at: index) }
        weightPopup.translatesAutoresizingMaskIntoConstraints = false
        weightPopup.widthAnchor.constraint(equalToConstant: 110).isActive = true
        weightPopups[role] = weightPopup

        let familyField = NSTextField()
        familyField.stringValue = style.family ?? ""
        familyField.placeholderString = "System"
        familyField.identifier = roleID
        familyField.isEditable = editable
        familyField.target = self
        familyField.action = #selector(typographyChanged(_:))
        familyField.translatesAutoresizingMaskIntoConstraints = false
        familyField.widthAnchor.constraint(equalToConstant: 140).isActive = true
        familyFields[role] = familyField

        let row = NSStackView(views: [
            captionLabel(role.rawValue.capitalized, width: 70), sizeField, stepper, weightPopup, familyField
        ])
        row.orientation = .horizontal
        row.spacing = 8
        row.alignment = .centerY
        return row
    }

    private func captionLabel(_ text: String, width: CGFloat) -> NSTextField {
        let label = NSTextField(labelWithString: text)
        label.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        label.textColor = .secondaryLabelColor
        label.translatesAutoresizingMaskIntoConstraints = false
        label.widthAnchor.constraint(equalToConstant: width).isActive = true
        return label
    }

    @objc private func scaleChanged() {
        guard var theme = editingTheme, !store.isBuiltIn(id: theme.id) else { return }
        theme.typography.sizeScale = scaleSlider.doubleValue
        scaleLabel.stringValue = "\(Int((scaleSlider.doubleValue * 100).rounded()))%"
        persist(theme)
    }

    @objc private func sizeStepperChanged(_ sender: NSStepper) {
        guard let raw = sender.identifier?.rawValue, let role = TextRole(rawValue: raw) else { return }
        sizeFields[role]?.doubleValue = sender.doubleValue
        applyTypography(for: role)
    }

    @objc private func typographyChanged(_ sender: NSControl) {
        guard let raw = sender.identifier?.rawValue, let role = TextRole(rawValue: raw) else { return }
        if let field = sizeFields[role] { sizeSteppers[role]?.doubleValue = field.doubleValue }
        applyTypography(for: role)
    }

    private func applyTypography(for role: TextRole) {
        guard var theme = editingTheme, !store.isBuiltIn(id: theme.id) else { return }
        let size = max(8, min(48, sizeFields[role]?.doubleValue ?? ThemeTypography.defaultStyle(role).size))
        let weight = (weightPopups[role]?.selectedItem?.representedObject as? FontWeight) ?? .regular
        let familyRaw = familyFields[role]?.stringValue.trimmingCharacters(in: .whitespaces) ?? ""
        let family = familyRaw.isEmpty ? nil : familyRaw
        let isMono = ThemeTypography.defaultStyle(role).monospaced
        theme.typography.styles[role.rawValue] = FontStyle(
            family: family, size: size, weight: weight, monospaced: isMono
        )
        persist(theme)
    }

    private func rebuildWells(for theme: ColorTheme, editable: Bool) {
        wellsContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        colorWells.removeAll()

        let mainRow = NSStackView(views: [
            wellColumn("FG", .foreground, theme.foreground, editable),
            wellColumn("BG", .background, theme.background, editable),
            wellColumn("Cursor", .cursor, theme.cursor, editable),
            wellColumn("Sel", .selection, theme.selection, editable)
        ])
        mainRow.orientation = .horizontal
        mainRow.spacing = 10
        wellsContainer.addArrangedSubview(mainRow)

        let ansiLabel = NSTextField(labelWithString: "ANSI")
        ansiLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        ansiLabel.textColor = .secondaryLabelColor
        wellsContainer.addArrangedSubview(ansiLabel)

        for half in 0..<2 {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 4
            for offset in 0..<8 {
                let index = half * 8 + offset
                guard theme.ansi.indices.contains(index) else { continue }
                row.addArrangedSubview(wellColumn("\(index)", .ansi(index), theme.ansi[index], editable))
            }
            wellsContainer.addArrangedSubview(row)
        }

        // Semantic chrome roles — resolved (override or derived) values; editing
        // one writes an override so users can theme backgrounds/panels/borders/
        // outlines/text directly.
        let rolesLabel = NSTextField(labelWithString: "App roles")
        rolesLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        rolesLabel.textColor = .secondaryLabelColor
        wellsContainer.addArrangedSubview(rolesLabel)

        let palette = SemanticPalette(theme: theme)
        let roles = Self.editableRoles
        for chunk in stride(from: 0, to: roles.count, by: 5) {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 4
            for role in roles[chunk..<min(chunk + 5, roles.count)] {
                let caption = Self.roleCaptions[role] ?? role.rawValue
                row.addArrangedSubview(wellColumn(caption, .role(role), palette.color(role), editable))
            }
            wellsContainer.addArrangedSubview(row)
        }
    }

    private func wellColumn(_ caption: String, _ slot: Slot, _ rgba: RGBAColor, _ editable: Bool) -> NSView {
        let well = NSColorWell()
        well.color = NSColor(rgba)
        well.isEnabled = editable
        well.target = self
        well.action = #selector(colorWellChanged(_:))
        well.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            well.widthAnchor.constraint(equalToConstant: 30),
            well.heightAnchor.constraint(equalToConstant: 22)
        ])
        colorWells.append((slot, well))

        let label = NSTextField(labelWithString: caption)
        label.font = .systemFont(ofSize: 9)
        label.textColor = .secondaryLabelColor
        label.alignment = .center

        let column = NSStackView(views: [well, label])
        column.orientation = .vertical
        column.spacing = 2
        column.alignment = .centerX
        return column
    }

    // MARK: - Edits

    @objc private func colorWellChanged(_ sender: NSColorWell) {
        guard let entry = colorWells.first(where: { $0.well === sender }) else { return }
        let srgb = sender.color.usingColorSpace(.sRGB) ?? sender.color
        apply(RGBAColor(srgb), to: entry.slot)
    }

    private func apply(_ rgba: RGBAColor, to slot: Slot) {
        guard var theme = editingTheme, !store.isBuiltIn(id: theme.id) else { return }
        switch slot {
        case .foreground: theme.foreground = rgba
        case .background: theme.background = rgba
        case .cursor: theme.cursor = rgba
        case .selection: theme.selection = rgba
        case .ansi(let index) where theme.ansi.indices.contains(index): theme.ansi[index] = rgba
        case .ansi: return
        case .role(let role): theme.roleOverrides[role.rawValue] = rgba
        }
        persist(theme)
    }

    @objc private func nameChanged() {
        guard var theme = editingTheme, !store.isBuiltIn(id: theme.id) else { return }
        theme.name = nameField.stringValue
        persist(theme, reloadRowOnly: true)
    }

    @objc private func appearanceChanged() {
        guard var theme = editingTheme, !store.isBuiltIn(id: theme.id),
              let appearance = appearancePopUp.selectedItem?.representedObject as? ThemeAppearance else { return }
        theme.appearance = appearance
        persist(theme, reloadRowOnly: true)
    }

    private func persist(_ theme: ColorTheme, reloadRowOnly: Bool = false) {
        editingTheme = theme
        store.update(theme)
        themes = store.allThemes
        preview.show(theme)
        let row = table.selectedRow
        if row >= 0 {
            table.reloadData(forRowIndexes: IndexSet(integer: row), columnIndexes: IndexSet(integer: 0))
        }
        // If the edited theme is active, refresh the app immediately.
        if UserSettings.activeThemeID.value == theme.id, let manager = ThemeManager.shared {
            manager.selectTheme(id: theme.id)
        }
        _ = reloadRowOnly
    }

    // MARK: - List actions

    @objc private func importTheme() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        if let type = UTType(filenameExtension: "itermcolors") {
            panel.allowedContentTypes = [type]
        }
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            let imported = try store.importITermColors(contentsOf: url)
            selectTheme(id: imported.id)
        } catch {
            presentImportError(error)
        }
    }

    @objc private func duplicateTheme() {
        guard let theme = editingTheme else { return }
        let copy = store.duplicate(theme)
        selectTheme(id: copy.id)
    }

    @objc private func deleteTheme() {
        guard let theme = editingTheme, !store.isBuiltIn(id: theme.id) else { return }
        store.delete(id: theme.id)
        themes = store.allThemes
        table.reloadData()
        let next = themes.first?.id ?? BuiltInThemes.defaultID
        selectTheme(id: next)
    }

    private func presentImportError(_ error: Error) {
        let alert = NSAlert()
        alert.messageText = "Couldn’t import theme"
        alert.informativeText = error.localizedDescription
        alert.alertStyle = .warning
        alert.runModal()
    }
}
