import AppKit
import UniformTypeIdentifiers
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// One theme's detail pane in the Theme settings split. Shows a live preview
/// plus, for a custom theme, the Colors / Typography / Terminal editor;
/// built-ins are read-only with a Duplicate affordance. Selecting the panel
/// (its row in the sidebar) activates the theme app-wide. Structural edits
/// (import / duplicate / delete) call `onStructuralChange` so the parent split
/// rebuilds its panel list; a rename calls `onRowInvalidated` so the sidebar
/// row re-reads its title/swatch without tearing the editor down.
@MainActor
final class ThemeDetailPanelViewController: ComposableSettings.SettingsPanelViewController {

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

    private let store: ThemeStore
    private var theme: ColorTheme
    private let onStructuralChange: (_ selectID: String) -> Void
    private let onRowInvalidated: () -> Void

    /// The theme this panel edits, for the parent split's selection bookkeeping.
    var themeID: String { theme.id }

    private let preview = ComposableSettings.ThemePreviewView()
    private var colorWells: [(slot: Slot, well: NSColorWell)] = []
    private var sizeFields: [TextRole: NSTextField] = [:]
    private var sizeSteppers: [TextRole: NSStepper] = [:]
    private var weightPopups: [TextRole: NSPopUpButton] = [:]
    private var familyFields: [TextRole: NSTextField] = [:]
    private let scaleLabel = NSTextField(labelWithString: "100%")
    /// Coalesces the expensive global side effects of an edit (see persist).
    private var pendingRefresh: DispatchWorkItem?

    init(theme: ColorTheme,
         store: ThemeStore,
         onStructuralChange: @escaping (_ selectID: String) -> Void,
         onRowInvalidated: @escaping () -> Void) {
        self.theme = theme
        self.store = store
        self.onStructuralChange = onStructuralChange
        self.onRowInvalidated = onRowInvalidated
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: theme.name,
            icon: Self.swatch(for: theme)))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// The detail hosts its own scroll so a wide editor grid can overflow into a
    /// horizontal scroll rather than force the window wider.
    var hostsOwnScroll: Bool { true }

    // MARK: - View

    override func loadView() {
        let editable = !store.isBuiltIn(id: theme.id)
        let content = editable ? makeEditor() : makeBuiltInNotice()
        content.translatesAutoresizingMaskIntoConstraints = false

        let doc = ThemeFlippedView()
        doc.translatesAutoresizingMaskIntoConstraints = false
        doc.addSubview(content)

        let scroll = NSScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.hasVerticalScroller = true
        scroll.hasHorizontalScroller = true
        scroll.autohidesScrollers = true
        scroll.drawsBackground = false
        scroll.documentView = doc

        let clip = scroll.contentView
        NSLayoutConstraint.activate([
            doc.topAnchor.constraint(equalTo: clip.topAnchor),
            doc.leadingAnchor.constraint(equalTo: clip.leadingAnchor),
            // Fill the viewport; a wide editor grid overflows horizontally.
            doc.widthAnchor.constraint(greaterThanOrEqualTo: clip.widthAnchor),

            content.topAnchor.constraint(equalTo: doc.topAnchor, constant: 16),
            content.leadingAnchor.constraint(equalTo: doc.leadingAnchor, constant: 16),
            content.trailingAnchor.constraint(equalTo: doc.trailingAnchor, constant: -16),
            content.bottomAnchor.constraint(equalTo: doc.bottomAnchor, constant: -20)
        ])
        self.view = scroll
    }

    /// Selecting a theme row activates it app-wide.
    override func viewWillAppear() {
        super.viewWillAppear()
        if let manager = ThemeManager.shared {
            manager.selectTheme(id: theme.id)
        } else {
            UserSettings.activeThemeID.value = theme.id
        }
    }

    // MARK: - Detail content

    private func configurePreview() {
        preview.show(theme)
        preview.wantsLayer = true
        preview.layer?.cornerRadius = 10
        preview.layer?.masksToBounds = true
        preview.translatesAutoresizingMaskIntoConstraints = false
        preview.heightAnchor.constraint(greaterThanOrEqualToConstant: 150).isActive = true
    }

    private func makeBuiltInNotice() -> NSView {
        configurePreview()
        let label = NSTextField(wrappingLabelWithString:
            "Built-in theme — duplicate it to customize its colors and fonts.")
        label.textColor = ThemePaletteObserver.currentPalette.secondaryTextColor
        label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let stack = NSStackView(views: [preview, label, makeActionsRow(editable: false)])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        preview.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        return stack
    }

    private func makeEditor() -> NSView {
        colorWells.removeAll()
        sizeFields.removeAll(); sizeSteppers.removeAll()
        weightPopups.removeAll(); familyFields.removeAll()

        configurePreview()

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

        let colors = ThemeDisclosureGroup(title: "Colors", content: makeColorsEditor(), expanded: true)
        let typography = ThemeDisclosureGroup(title: "Typography",
                                         content: makeTypographyEditor(), expanded: false)
        let terminal = ThemeDisclosureGroup(title: "Terminal palette (advanced)",
                                       content: makeTerminalEditor(), expanded: false)

        let stack = NSStackView(views: [preview, meta, colors, typography, terminal,
                                        makeActionsRow(editable: true)])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        for view in [preview, colors, typography, terminal] {
            view.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }
        return stack
    }

    /// Import (global) + Duplicate, plus Delete for a custom theme.
    private func makeActionsRow(editable: Bool) -> NSView {
        let importButton = NSButton(title: "Import…", target: self, action: #selector(importTheme))
        importButton.bezelStyle = .rounded
        importButton.image = NSImage(systemSymbolName: "square.and.arrow.down", accessibilityDescription: nil)
        importButton.imagePosition = .imageLeading
        importButton.toolTip = "Import an .itermcolors theme"

        let duplicate = NSButton(title: editable ? "Duplicate" : "Duplicate to Edit",
                                 target: self, action: #selector(duplicateTheme))
        duplicate.bezelStyle = .rounded
        if !editable { duplicate.keyEquivalent = "\r" }

        var views: [NSView] = [importButton, duplicate]
        if editable {
            let delete = NSButton(title: "Delete Theme", target: self, action: #selector(deleteSelected))
            delete.bezelStyle = .rounded
            delete.hasDestructiveAction = true
            views.append(delete)
        }
        let row = NSStackView(views: views)
        row.orientation = .horizontal
        row.spacing = 8
        return row
    }

    // MARK: - Colors editor

    private func makeColorsEditor() -> NSView {
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

    private func makeTerminalEditor() -> NSView {
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
        label.textColor = ThemePaletteObserver.currentPalette.secondaryTextColor
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

    private func makeTypographyEditor() -> NSView {
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
            grid.addRow(with: typographyCells(role))
        }
        grid.column(at: 0).xPlacement = .leading

        let stack = NSStackView(views: [scaleRow, grid])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        return stack
    }

    private func typographyCells(_ role: TextRole) -> [NSView] {
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
        label.textColor = ThemePaletteObserver.currentPalette.secondaryTextColor
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
        label.textColor = ThemePaletteObserver.currentPalette.secondaryTextColor
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
        guard !store.isBuiltIn(id: theme.id) else { return }
        var updated = theme
        switch slot {
        case .foreground: updated.foreground = rgba
        case .background: updated.background = rgba
        case .cursor: updated.cursor = rgba
        case .selection: updated.selection = rgba
        case .ansi(let index) where updated.ansi.indices.contains(index): updated.ansi[index] = rgba
        case .ansi: return
        case .role(let role): updated.roleOverrides[role.rawValue] = rgba
        }
        persist(updated)
    }

    @objc private func nameChanged(_ sender: NSTextField) {
        guard !store.isBuiltIn(id: theme.id) else { return }
        var updated = theme
        updated.name = sender.stringValue
        descriptor.title = updated.name
        persist(updated)
        // The sidebar row snapshots its title once; re-read it after a rename.
        onRowInvalidated()
    }

    @objc private func appearanceChanged(_ sender: NSPopUpButton) {
        guard !store.isBuiltIn(id: theme.id),
              let appearance = sender.selectedItem?.representedObject as? ThemeAppearance else { return }
        var updated = theme
        updated.appearance = appearance
        persist(updated)
    }

    @objc private func scaleChanged(_ sender: NSSlider) {
        guard !store.isBuiltIn(id: theme.id) else { return }
        var updated = theme
        updated.typography.sizeScale = sender.doubleValue
        scaleLabel.stringValue = "\(Int((sender.doubleValue * 100).rounded()))%"
        persist(updated)
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
        guard !store.isBuiltIn(id: theme.id) else { return }
        let size = max(8, min(48, sizeFields[role]?.doubleValue ?? ThemeTypography.defaultStyle(role).size))
        // Reflect the clamp back so the field/stepper show what's actually applied
        // (typing "100" lands on 48, not a stale out-of-range "100").
        sizeFields[role]?.doubleValue = size
        sizeSteppers[role]?.doubleValue = size
        let weight = (weightPopups[role]?.selectedItem?.representedObject as? FontWeight) ?? .regular
        let familyRaw = familyFields[role]?.stringValue.trimmingCharacters(in: .whitespaces) ?? ""
        let family = familyRaw.isEmpty ? nil : familyRaw
        let isMono = ThemeTypography.defaultStyle(role).monospaced
        var updated = theme
        updated.typography.styles[role.rawValue] = FontStyle(
            family: family, size: size, weight: weight, monospaced: isMono)
        persist(updated)
    }

    private func persist(_ updated: ColorTheme) {
        theme = updated
        // Keep the store authoritative and the in-panel preview live every tick
        // (both cheap and local, so a structural edit always sees the latest).
        store.update(updated)
        preview.show(updated)
        // Coalesce the expensive, purely-cosmetic global work — the app-wide
        // re-theme and the sidebar swatch refresh — so dragging a color well
        // doesn't repaint every window and rebuild the sidebar on every tick.
        pendingRefresh?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.applyGlobalRefresh(updated) }
        pendingRefresh = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: work)
    }

    /// The debounced tail of persist(_:): refresh the sidebar swatch and re-apply
    /// the theme app-wide once edits settle. Safe to skip if the panel is torn
    /// down first — a structural rebuild re-themes and re-reads the swatch anyway.
    private func applyGlobalRefresh(_ updated: ColorTheme) {
        descriptor.icon = Self.swatch(for: updated)
        onRowInvalidated()
        if UserSettings.activeThemeID.value == updated.id, let manager = ThemeManager.shared {
            manager.selectTheme(id: updated.id)
        }
    }

    // MARK: - Structural actions

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
            onStructuralChange(imported.id)
        } catch {
            presentImportError(error)
        }
    }

    @objc private func duplicateTheme() {
        let copy = store.duplicate(theme)
        onStructuralChange(copy.id)
    }

    @objc private func deleteSelected() {
        guard !store.isBuiltIn(id: theme.id) else { return }
        store.delete(id: theme.id)
        onStructuralChange(store.allThemes.first?.id ?? BuiltInThemes.defaultID)
    }

    private func presentImportError(_ error: Error) {
        let alert = NSAlert()
        alert.messageText = "Couldn’t import theme"
        alert.informativeText = error.localizedDescription
        alert.alertStyle = .warning
        alert.runModal()
    }

    // MARK: - Sidebar swatch

    /// A small color chip for the sidebar row: the theme's background with an
    /// accent dot, so themes are recognizable at a glance.
    private static func swatch(for theme: ColorTheme) -> NSImage {
        let size = NSSize(width: 22, height: 16)
        let image = NSImage(size: size, flipped: false) { rect in
            let body = rect.insetBy(dx: 1, dy: 1)
            let path = NSBezierPath(roundedRect: body, xRadius: 4, yRadius: 4)
            NSColor(theme.background).setFill()
            path.fill()
            NSColor.separatorColor.setStroke()
            path.lineWidth = 1
            path.stroke()
            let palette = SemanticPalette(theme: theme)
            NSColor(palette.color(.accent)).setFill()
            NSBezierPath(ovalIn: NSRect(x: body.minX + 4, y: body.midY - 3, width: 6, height: 6)).fill()
            return true
        }
        image.isTemplate = false
        return image
    }
}
