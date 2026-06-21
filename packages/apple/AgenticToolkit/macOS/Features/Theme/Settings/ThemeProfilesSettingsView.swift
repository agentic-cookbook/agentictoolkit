import AppKit
import UniformTypeIdentifiers
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Theme settings, gallery-first. The page is a grid of **rendered theme
/// thumbnails** (show, don't tell) — click one to apply it app-wide. Editing is
/// behind progressive disclosure: a collapsed "Customize" section that, for a
/// custom theme, reveals a live preview and disclosure groups for Colors,
/// Typography, and the advanced Terminal palette. Built-ins are read-only
/// (duplicate to edit). Content pins to the top (flipped document view).
public final class ThemeProfilesSettingsView: NSView {

    private enum Slot: Equatable {
        case foreground, background, cursor, selection, ansi(Int)
        case role(ThemeRole)
    }

    private static let colorGroups: [(title: String, items: [(ThemeRole, String)])] = [
        ("Backgrounds", [(.windowBackground, "Window"), (.surface, "Panel"),
                         (.elevatedSurface, "Raised"), (.controlBackground, "Field")]),
        ("Text", [(.primaryText, "Primary"), (.secondaryText, "Secondary"),
                  (.tertiaryText, "Tertiary"), (.placeholderText, "Placeholder"),
                  (.onAccentText, "On accent")]),
        ("Accent & status", [(.accent, "Accent"), (.success, "Success"),
                             (.warning, "Warning"), (.danger, "Error"), (.info, "Info")]),
        ("Lines & selection", [(.border, "Border"), (.outline, "Outline"),
                               (.divider, "Divider"), (.selection, "Selection")])
    ]

    private let store = ThemeStore()
    private var themes: [ColorTheme] = []
    private var editingTheme: ColorTheme?

    private let scrollView = NSScrollView()
    private let contentStack = NSStackView()
    private let galleryStack = NSStackView()
    private let customizeHost = NSStackView()
    private var cards: [ThemeCardView] = []

    private var colorWells: [(slot: Slot, well: NSColorWell)] = []
    private var sizeFields: [TextRole: NSTextField] = [:]
    private var sizeSteppers: [TextRole: NSStepper] = [:]
    private var weightPopups: [TextRole: NSPopUpButton] = [:]
    private var familyFields: [TextRole: NSTextField] = [:]
    private let scaleLabel = NSTextField(labelWithString: "100%")

    public override init(frame: NSRect) {
        super.init(frame: frame)
        self.themes = store.allThemes
        setupViews()
        editingTheme = themes.first { $0.id == UserSettings.activeThemeID.value } ?? themes.first
        rebuildGallery()
        rebuildCustomize()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    // MARK: - Setup

    private func setupViews() {
        let scroll = scrollView
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        scroll.automaticallyAdjustsContentInsets = false
        scroll.translatesAutoresizingMaskIntoConstraints = false

        let doc = FlippedView()
        doc.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = doc

        let header = makeHeader()

        galleryStack.orientation = .vertical
        galleryStack.alignment = .leading
        galleryStack.spacing = 14
        galleryStack.translatesAutoresizingMaskIntoConstraints = false

        customizeHost.orientation = .vertical
        customizeHost.alignment = .leading
        customizeHost.spacing = 8
        customizeHost.translatesAutoresizingMaskIntoConstraints = false

        contentStack.orientation = .vertical
        contentStack.alignment = .leading
        contentStack.spacing = 20
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.edgeInsets = NSEdgeInsets(top: 18, left: 20, bottom: 24, right: 20)
        [header, sectionTitle("THEMES"), galleryStack, customizeHost]
            .forEach { contentStack.addArrangedSubview($0) }

        doc.addSubview(contentStack)
        addSubview(scroll)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: topAnchor),
            scroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: bottomAnchor),
            doc.topAnchor.constraint(equalTo: scroll.topAnchor),
            doc.leadingAnchor.constraint(equalTo: scroll.leadingAnchor),
            doc.trailingAnchor.constraint(equalTo: scroll.trailingAnchor),
            doc.widthAnchor.constraint(equalTo: scroll.widthAnchor),
            contentStack.topAnchor.constraint(equalTo: doc.topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: doc.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: doc.trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: doc.bottomAnchor),
            widthAnchor.constraint(greaterThanOrEqualToConstant: 520)
        ])
        // Header, gallery and customize span the content width.
        for view in [header, galleryStack, customizeHost] {
            view.widthAnchor.constraint(equalTo: contentStack.widthAnchor, constant: -40).isActive = true
        }
    }

    private func makeHeader() -> NSView {
        let title = NSTextField(labelWithString: "Theme")
        title.font = .systemFont(ofSize: 17, weight: .bold)

        let importButton = NSButton(title: "Import…", target: self, action: #selector(importTheme))
        importButton.bezelStyle = .rounded
        importButton.image = NSImage(systemSymbolName: "square.and.arrow.down", accessibilityDescription: nil)
        importButton.imagePosition = .imageLeading
        importButton.toolTip = "Import an .itermcolors theme"

        let newButton = NSButton(title: "New from Current", target: self, action: #selector(duplicateTheme))
        newButton.bezelStyle = .rounded
        newButton.image = NSImage(systemSymbolName: "plus", accessibilityDescription: nil)
        newButton.imagePosition = .imageLeading
        newButton.toolTip = "Duplicate the selected theme to customize it"

        let spacer = NSView()
        spacer.setContentHuggingPriority(.init(1), for: .horizontal)
        let row = NSStackView(views: [title, spacer, importButton, newButton])
        row.orientation = .horizontal
        row.spacing = 8
        row.alignment = .centerY
        return row
    }

    // MARK: - Gallery

    private func rebuildGallery() {
        galleryStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        cards.removeAll()
        let activeID = UserSettings.activeThemeID.value
        let columns = 3
        for chunk in stride(from: 0, to: themes.count, by: columns) {
            let rowThemes = themes[chunk..<min(chunk + columns, themes.count)]
            let row = NSStackView()
            row.orientation = .horizontal
            row.distribution = .fillEqually
            row.spacing = 14
            row.translatesAutoresizingMaskIntoConstraints = false
            for theme in rowThemes {
                let card = ThemeCardView(theme: theme, isActive: theme.id == activeID) { [weak self] id in
                    self?.selectTheme(id: id)
                }
                cards.append(card)
                row.addArrangedSubview(card)
            }
            // Pad the final short row so cards keep their column width.
            for _ in rowThemes.count..<columns { row.addArrangedSubview(NSView()) }
            galleryStack.addArrangedSubview(row)
            row.widthAnchor.constraint(equalTo: galleryStack.widthAnchor).isActive = true
        }
    }

    private func selectTheme(id: String) {
        if let manager = ThemeManager.shared {
            manager.selectTheme(id: id)
        } else {
            UserSettings.activeThemeID.value = id
        }
        editingTheme = themes.first { $0.id == id }
        for card in cards { card.isActive = card.themeID == id }
        rebuildCustomize()
        // Clicking a theme discloses it — bring the disclosed section into view.
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.layoutSubtreeIfNeeded()
            self.customizeHost.scrollToVisible(self.customizeHost.bounds)
        }
    }

    // MARK: - Customize (progressive disclosure)

    private func rebuildCustomize() {
        customizeHost.arrangedSubviews.forEach { $0.removeFromSuperview() }
        guard let theme = editingTheme else { return }
        let editable = !store.isBuiltIn(id: theme.id)

        // Clicking a theme always discloses it (expanded) — editor for a custom
        // theme, or a preview + Duplicate affordance for a read-only built-in.
        let content: NSView = editable ? makeEditor(for: theme) : makeBuiltInNotice(for: theme)
        let title = editable ? "Edit \(theme.name)" : "\(theme.name)"
        let group = DisclosureGroup(title: title, content: content, expanded: true)
        group.translatesAutoresizingMaskIntoConstraints = false
        customizeHost.addArrangedSubview(group)
        group.widthAnchor.constraint(equalTo: customizeHost.widthAnchor).isActive = true
    }

    private func makeBuiltInNotice(for theme: ColorTheme) -> NSView {
        let preview = ComposableSettings.ThemePreviewView(theme: theme)
        preview.wantsLayer = true
        preview.layer?.cornerRadius = 10
        preview.layer?.masksToBounds = true
        preview.translatesAutoresizingMaskIntoConstraints = false
        preview.heightAnchor.constraint(greaterThanOrEqualToConstant: 150).isActive = true

        let label = NSTextField(wrappingLabelWithString:
            "Built-in theme — duplicate it to customize its colors and fonts.")
        label.textColor = .secondaryLabelColor
        let button = NSButton(title: "Duplicate to Edit", target: self, action: #selector(duplicateTheme))
        button.bezelStyle = .rounded
        button.keyEquivalent = "\r"
        let row = NSStackView(views: [label, button])
        row.orientation = .horizontal
        row.spacing = 12
        row.alignment = .centerY

        let stack = NSStackView(views: [preview, row])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        preview.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        return stack
    }

    private func makeEditor(for theme: ColorTheme) -> NSView {
        colorWells.removeAll()
        sizeFields.removeAll(); sizeSteppers.removeAll()
        weightPopups.removeAll(); familyFields.removeAll()

        let preview = ComposableSettings.ThemePreviewView(theme: theme)
        preview.wantsLayer = true
        preview.layer?.cornerRadius = 10
        preview.layer?.masksToBounds = true
        preview.translatesAutoresizingMaskIntoConstraints = false
        preview.heightAnchor.constraint(greaterThanOrEqualToConstant: 150).isActive = true

        let nameField = NSTextField(string: theme.name)
        nameField.target = self
        nameField.action = #selector(nameChanged(_:))
        let appearancePopUp = NSPopUpButton()
        for appearance in ThemeAppearance.allCases {
            appearancePopUp.addItem(withTitle: appearance.rawValue.capitalized)
            appearancePopUp.lastItem?.representedObject = appearance
        }
        appearancePopUp.target = self
        appearancePopUp.action = #selector(appearanceChanged(_:))
        for (index, item) in appearancePopUp.itemArray.enumerated()
        where item.representedObject as? ThemeAppearance == theme.appearance {
            appearancePopUp.selectItem(at: index)
        }
        let meta = NSGridView(views: [
            [rightLabel("Name"), nameField],
            [rightLabel("Style"), appearancePopUp]
        ])
        meta.rowSpacing = 8
        meta.columnSpacing = 8
        meta.column(at: 0).xPlacement = .leading

        let colors = DisclosureGroup(title: "Colors", content: makeColorsEditor(for: theme), expanded: true)
        let typography = DisclosureGroup(title: "Typography",
                                         content: makeTypographyEditor(for: theme), expanded: false)
        let terminal = DisclosureGroup(title: "Terminal palette (advanced)",
                                       content: makeTerminalEditor(for: theme), expanded: false)

        let duplicate = NSButton(title: "Duplicate", target: self, action: #selector(duplicateTheme))
        duplicate.bezelStyle = .rounded
        let delete = NSButton(title: "Delete Theme", target: self, action: #selector(deleteSelected))
        delete.bezelStyle = .rounded
        delete.hasDestructiveAction = true
        let footer = NSStackView(views: [duplicate, delete])
        footer.orientation = .horizontal
        footer.spacing = 8

        let stack = NSStackView(views: [preview, meta, colors, typography, terminal, footer])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        for view in [preview, colors, typography, terminal] {
            view.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }
        return stack
    }

    // MARK: - Colors editor

    private func makeColorsEditor(for theme: ColorTheme) -> NSView {
        let palette = SemanticPalette(theme: theme)
        let container = NSStackView()
        container.orientation = .vertical
        container.alignment = .leading
        container.spacing = 14
        for group in Self.colorGroups {
            let header = sectionTitle(group.title.uppercased())
            let grid = NSStackView()
            grid.orientation = .vertical
            grid.alignment = .leading
            grid.spacing = 8
            for chunk in stride(from: 0, to: group.items.count, by: 5) {
                let rowItems = group.items[chunk..<min(chunk + 5, group.items.count)]
                let rowView = NSStackView()
                rowView.orientation = .horizontal
                rowView.spacing = 8
                for (role, label) in rowItems {
                    rowView.addArrangedSubview(wellColumn(label, .role(role), palette.color(role)))
                }
                grid.addArrangedSubview(rowView)
            }
            let box = NSStackView(views: [header, grid])
            box.orientation = .vertical
            box.alignment = .leading
            box.spacing = 6
            container.addArrangedSubview(box)
        }
        return container
    }

    private func makeTerminalEditor(for theme: ColorTheme) -> NSView {
        let container = NSStackView()
        container.orientation = .vertical
        container.alignment = .leading
        container.spacing = 8
        let baseRow = NSStackView(views: [
            wellColumn("FG", .foreground, theme.foreground),
            wellColumn("BG", .background, theme.background),
            wellColumn("Cursor", .cursor, theme.cursor),
            wellColumn("Sel", .selection, theme.selection)
        ])
        baseRow.orientation = .horizontal
        baseRow.spacing = 8
        container.addArrangedSubview(baseRow)
        for half in 0..<2 {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 6
            for offset in 0..<8 {
                let index = half * 8 + offset
                guard theme.ansi.indices.contains(index) else { continue }
                row.addArrangedSubview(ansiWell(index, theme.ansi[index]))
            }
            container.addArrangedSubview(row)
        }
        return container
    }

    private func wellColumn(_ caption: String, _ slot: Slot, _ rgba: RGBAColor) -> NSView {
        let well = NSColorWell()
        well.color = NSColor(rgba)
        well.target = self
        well.action = #selector(colorWellChanged(_:))
        well.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            well.widthAnchor.constraint(equalToConstant: 40),
            well.heightAnchor.constraint(equalToConstant: 24)
        ])
        colorWells.append((slot, well))

        let label = NSTextField(labelWithString: caption)
        label.font = .systemFont(ofSize: 10)
        label.textColor = .secondaryLabelColor
        label.alignment = .center
        let column = NSStackView(views: [well, label])
        column.orientation = .vertical
        column.spacing = 3
        column.alignment = .centerX
        column.translatesAutoresizingMaskIntoConstraints = false
        column.widthAnchor.constraint(equalToConstant: 72).isActive = true
        return column
    }

    private func ansiWell(_ index: Int, _ rgba: RGBAColor) -> NSView {
        let well = NSColorWell()
        well.color = NSColor(rgba)
        well.target = self
        well.action = #selector(colorWellChanged(_:))
        well.toolTip = "ANSI \(index)"
        well.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            well.widthAnchor.constraint(equalToConstant: 26),
            well.heightAnchor.constraint(equalToConstant: 22)
        ])
        colorWells.append((.ansi(index), well))
        return well
    }

    // MARK: - Typography editor

    private func makeTypographyEditor(for theme: ColorTheme) -> NSView {
        let scale = NSSlider(value: theme.typography.sizeScale, minValue: 0.8, maxValue: 1.6,
                             target: self, action: #selector(scaleChanged(_:)))
        scale.translatesAutoresizingMaskIntoConstraints = false
        scale.widthAnchor.constraint(equalToConstant: 160).isActive = true
        scaleLabel.stringValue = "\(Int((theme.typography.sizeScale * 100).rounded()))%"
        let scaleRow = NSStackView(views: [captionLabel("Text size", 64), scale, scaleLabel])
        scaleRow.orientation = .horizontal
        scaleRow.spacing = 8

        let grid = NSGridView()
        grid.rowSpacing = 8
        grid.columnSpacing = 8
        grid.addRow(with: [captionLabel("", 60), captionLabel("Size", 76),
                           captionLabel("Weight", 110), captionLabel("Font family", 150)])
        for role in TextRole.allCases {
            grid.addRow(with: typographyCells(role, theme: theme))
        }
        grid.column(at: 0).xPlacement = .leading

        let stack = NSStackView(views: [scaleRow, grid])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        return stack
    }

    private func typographyCells(_ role: TextRole, theme: ColorTheme) -> [NSView] {
        let style = theme.typography.style(role)
        let roleID = NSUserInterfaceItemIdentifier(role.rawValue)

        let sizeField = NSTextField()
        sizeField.doubleValue = style.size
        sizeField.identifier = roleID
        sizeField.target = self
        sizeField.action = #selector(typographyChanged(_:))
        sizeField.translatesAutoresizingMaskIntoConstraints = false
        sizeField.widthAnchor.constraint(equalToConstant: 48).isActive = true
        sizeFields[role] = sizeField

        let stepper = NSStepper()
        stepper.minValue = 8; stepper.maxValue = 48; stepper.increment = 1
        stepper.doubleValue = style.size
        stepper.identifier = roleID
        stepper.target = self
        stepper.action = #selector(sizeStepperChanged(_:))
        sizeSteppers[role] = stepper
        let sizeCell = NSStackView(views: [sizeField, stepper])
        sizeCell.orientation = .horizontal
        sizeCell.spacing = 2

        let weightPopup = NSPopUpButton()
        for weight in FontWeight.allCases {
            weightPopup.addItem(withTitle: weight.rawValue.capitalized)
            weightPopup.lastItem?.representedObject = weight
        }
        weightPopup.identifier = roleID
        weightPopup.target = self
        weightPopup.action = #selector(typographyChanged(_:))
        if let index = FontWeight.allCases.firstIndex(of: style.weight) { weightPopup.selectItem(at: index) }
        weightPopups[role] = weightPopup

        let familyField = NSTextField()
        familyField.stringValue = style.family ?? ""
        familyField.placeholderString = "System"
        familyField.identifier = roleID
        familyField.target = self
        familyField.action = #selector(typographyChanged(_:))
        familyField.translatesAutoresizingMaskIntoConstraints = false
        familyField.widthAnchor.constraint(equalToConstant: 150).isActive = true
        familyFields[role] = familyField

        return [NSTextField(labelWithString: role.rawValue.capitalized), sizeCell, weightPopup, familyField]
    }

    // MARK: - Small builders

    private func sectionTitle(_ text: String) -> NSTextField {
        let label = NSTextField(labelWithString: text)
        label.font = .systemFont(ofSize: 11, weight: .semibold)
        label.textColor = .secondaryLabelColor
        return label
    }

    private func rightLabel(_ text: String) -> NSTextField {
        let label = NSTextField(labelWithString: text)
        label.alignment = .right
        return label
    }

    private func captionLabel(_ text: String, _ width: CGFloat) -> NSTextField {
        let label = NSTextField(labelWithString: text)
        label.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        label.textColor = .secondaryLabelColor
        label.translatesAutoresizingMaskIntoConstraints = false
        label.widthAnchor.constraint(equalToConstant: width).isActive = true
        return label
    }

    // MARK: - Edit handlers

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

    @objc private func nameChanged(_ sender: NSTextField) {
        guard var theme = editingTheme, !store.isBuiltIn(id: theme.id) else { return }
        theme.name = sender.stringValue
        persist(theme)
    }

    @objc private func appearanceChanged(_ sender: NSPopUpButton) {
        guard var theme = editingTheme, !store.isBuiltIn(id: theme.id),
              let appearance = sender.selectedItem?.representedObject as? ThemeAppearance else { return }
        theme.appearance = appearance
        persist(theme)
    }

    @objc private func scaleChanged(_ sender: NSSlider) {
        guard var theme = editingTheme, !store.isBuiltIn(id: theme.id) else { return }
        theme.typography.sizeScale = sender.doubleValue
        scaleLabel.stringValue = "\(Int((sender.doubleValue * 100).rounded()))%"
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
            family: family, size: size, weight: weight, monospaced: isMono)
        persist(theme)
    }

    private func persist(_ theme: ColorTheme) {
        editingTheme = theme
        store.update(theme)
        themes = store.allThemes
        // Refresh the matching card's thumbnail + live app theme.
        if let card = cards.first(where: { $0.themeID == theme.id }) { card.update(theme: theme) }
        if UserSettings.activeThemeID.value == theme.id, let manager = ThemeManager.shared {
            manager.selectTheme(id: theme.id)
        }
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
            themes = store.allThemes
            rebuildGallery()
            selectTheme(id: imported.id)
        } catch {
            presentImportError(error)
        }
    }

    @objc private func duplicateTheme() {
        guard let theme = editingTheme else { return }
        let copy = store.duplicate(theme)
        themes = store.allThemes
        rebuildGallery()
        selectTheme(id: copy.id)
    }

    @objc private func deleteSelected() {
        guard let theme = editingTheme, !store.isBuiltIn(id: theme.id) else { return }
        store.delete(id: theme.id)
        themes = store.allThemes
        rebuildGallery()
        selectTheme(id: themes.first?.id ?? BuiltInThemes.defaultID)
    }

    private func presentImportError(_ error: Error) {
        let alert = NSAlert()
        alert.messageText = "Couldn’t import theme"
        alert.informativeText = error.localizedDescription
        alert.alertStyle = .warning
        alert.runModal()
    }
}

// MARK: - Flipped document view (content pins to the top)

private final class FlippedView: NSView {
    override var isFlipped: Bool { true }
}

// MARK: - Disclosure group (progressive disclosure, HIG triangle + label)

private final class DisclosureGroup: NSView {
    private let triangle = NSButton()
    private let body: NSView

    init(title: String, content: NSView, expanded: Bool) {
        self.body = content
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        triangle.title = title
        triangle.setButtonType(.onOff)
        triangle.bezelStyle = .disclosure
        triangle.state = expanded ? .on : .off
        triangle.target = self
        triangle.action = #selector(toggle)
        triangle.translatesAutoresizingMaskIntoConstraints = false

        let label = NSTextField(labelWithString: title)
        label.font = .systemFont(ofSize: 12, weight: .semibold)
        let labelClick = NSClickGestureRecognizer(target: self, action: #selector(toggle))
        label.addGestureRecognizer(labelClick)

        let header = NSStackView(views: [triangle, label])
        header.orientation = .horizontal
        header.spacing = 4
        header.translatesAutoresizingMaskIntoConstraints = false

        content.translatesAutoresizingMaskIntoConstraints = false
        content.isHidden = !expanded

        addSubview(header)
        addSubview(content)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: topAnchor),
            header.leadingAnchor.constraint(equalTo: leadingAnchor),
            content.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 8),
            content.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            content.trailingAnchor.constraint(equalTo: trailingAnchor),
            content.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    @objc private func toggle() {
        // Expand iff currently collapsed; keep the triangle state in sync whether
        // the triangle button or the label was clicked.
        let expand = body.isHidden
        body.isHidden = !expand
        triangle.state = expand ? .on : .off
    }
}

// MARK: - Theme thumbnail card (rendered "show, don't tell" preview)

private final class ThemeCardView: NSView {
    let themeID: String
    var isActive: Bool { didSet { needsDisplay = true } }
    private var theme: ColorTheme
    private let onSelect: (String) -> Void
    private let thumbnail: ThemeThumbnailView
    private let nameLabel = NSTextField(labelWithString: "")
    private let appearanceLabel = NSTextField(labelWithString: "")

    init(theme: ColorTheme, isActive: Bool, onSelect: @escaping (String) -> Void) {
        self.themeID = theme.id
        self.theme = theme
        self.isActive = isActive
        self.onSelect = onSelect
        self.thumbnail = ThemeThumbnailView(theme: theme)
        super.init(frame: .zero)
        wantsLayer = true
        translatesAutoresizingMaskIntoConstraints = false

        thumbnail.translatesAutoresizingMaskIntoConstraints = false
        thumbnail.wantsLayer = true
        thumbnail.layer?.cornerRadius = 7
        thumbnail.layer?.masksToBounds = true

        nameLabel.stringValue = theme.name
        nameLabel.font = .systemFont(ofSize: 12, weight: .medium)
        nameLabel.lineBreakMode = .byTruncatingTail
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        appearanceLabel.stringValue = theme.appearance.rawValue.capitalized
        appearanceLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        appearanceLabel.textColor = .tertiaryLabelColor
        appearanceLabel.translatesAutoresizingMaskIntoConstraints = false

        addSubview(thumbnail)
        addSubview(nameLabel)
        addSubview(appearanceLabel)
        NSLayoutConstraint.activate([
            thumbnail.topAnchor.constraint(equalTo: topAnchor, constant: 6),
            thumbnail.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
            thumbnail.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
            thumbnail.heightAnchor.constraint(equalToConstant: 96),
            nameLabel.topAnchor.constraint(equalTo: thumbnail.bottomAnchor, constant: 6),
            nameLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            nameLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -8),
            appearanceLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            appearanceLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 1),
            appearanceLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    func update(theme: ColorTheme) {
        self.theme = theme
        nameLabel.stringValue = theme.name
        appearanceLabel.stringValue = theme.appearance.rawValue.capitalized
        thumbnail.update(theme: theme)
    }

    override func updateLayer() {
        // Minimal chrome: the rendered thumbnail carries its own hairline; only the
        // active card gets an accent ring so the gallery stays clean.
        layer?.cornerRadius = 10
        layer?.borderWidth = isActive ? 3 : 0
        layer?.borderColor = NSColor.controlAccentColor.cgColor
        layer?.backgroundColor = NSColor.clear.cgColor
    }

    override var wantsUpdateLayer: Bool { true }

    override func mouseDown(with event: NSEvent) { onSelect(themeID) }
}

/// Draws a miniature app-window rendering of a theme: titlebar with traffic
/// lights, title/body/caption bars, an accent pill, status dots and a code line.
private final class ThemeThumbnailView: NSView {
    private var palette: SemanticPalette

    init(theme: ColorTheme) {
        self.palette = SemanticPalette(theme: theme)
        super.init(frame: .zero)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    func update(theme: ColorTheme) {
        palette = SemanticPalette(theme: theme)
        needsDisplay = true
    }

    override var isFlipped: Bool { true }

    override func draw(_ dirtyRect: NSRect) {
        let bounds = self.bounds
        func fill(_ rect: NSRect, _ color: NSColor, radius: CGFloat = 0) {
            color.setFill()
            NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
        }
        // Window background.
        fill(bounds, palette.nsColor(.windowBackground))
        // Title bar.
        let titleBarHeight: CGFloat = 18
        fill(NSRect(x: 0, y: 0, width: bounds.width, height: titleBarHeight), palette.nsColor(.surface))
        for (index, role) in [ThemeRole.danger, .warning, .success].enumerated() {
            let dot = NSRect(x: 8 + CGFloat(index) * 11, y: titleBarHeight / 2 - 3, width: 6, height: 6)
            fill(dot, palette.nsColor(role), radius: 3)
        }
        // Content.
        let left: CGFloat = 12
        var row = titleBarHeight + 12
        fill(NSRect(x: left, y: row, width: bounds.width * 0.5, height: 7),
             palette.nsColor(.primaryText), radius: 2)
        row += 14
        fill(NSRect(x: left, y: row, width: bounds.width * 0.72, height: 5),
             palette.nsColor(.secondaryText), radius: 2)
        row += 10
        fill(NSRect(x: left, y: row, width: bounds.width * 0.6, height: 5),
             palette.nsColor(.secondaryText), radius: 2)
        row += 14
        fill(NSRect(x: left, y: row, width: 38, height: 14), palette.nsColor(.accent), radius: 4)
        for (index, role) in [ThemeRole.info, .warning, .danger].enumerated() {
            let dot = NSRect(x: left + 48 + CGFloat(index) * 12, y: row + 3, width: 8, height: 8)
            fill(dot, palette.nsColor(role), radius: 4)
        }
        row += 22
        fill(NSRect(x: left, y: row, width: bounds.width * 0.66, height: 5),
             palette.nsColor(.tertiaryText), radius: 2)
        // Hairline border.
        palette.nsColor(.border).setStroke()
        let border = NSBezierPath(rect: bounds.insetBy(dx: 0.5, dy: 0.5))
        border.lineWidth = 1
        border.stroke()
    }
}
