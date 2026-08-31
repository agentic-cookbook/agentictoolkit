import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// "Typography" topic: the overall size scale, plus family / size / weight for
/// each text role.
@MainActor
final class ThemeTypographyTopicPanel: ThemeTopicPanel {

    private var sizeFields: [TextRole: NSTextField] = [:]
    private var sizeSteppers: [TextRole: NSStepper] = [:]
    private var weightPopups: [TextRole: NSPopUpButton] = [:]
    private var familyFields: [TextRole: NSTextField] = [:]
    private let scaleLabel = NSTextField(labelWithString: "100%")

    init(context: ThemeEditorContext) {
        super.init(context: context, title: "Typography", symbol: "textformat")
    }

    override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Text Size",
                body: "One multiplier over every size below, so a theme can be made larger "
                    + "or smaller as a whole without re-typing eight numbers and losing the "
                    + "relationships between them. It stacks with the app-wide text size in "
                    + "Appearance settings."
            ),
            .init(
                title: "Roles",
                body: "Each row is a role the app draws text in — title, body, caption, "
                    + "button, code, and so on — not a particular label. Leaving a family "
                    + "empty uses the system font, which is the right answer for most roles; "
                    + "roles that are monospaced by nature stay monospaced whatever you type."
            ),
            .init(
                title: "Sizes",
                body: "Sizes are in points and clamped to 8–48. A value outside that range "
                    + "snaps to the nearest end as you commit it, so the field always shows "
                    + "what is actually being drawn."
            )
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let group = ComposableSettings.GroupView(withTitle: "Typography")
        group.addSettingSubview(makeScaleRow())
        group.addSettingSubview(makeRolesGrid())
        addGroup(group)
    }

    private func makeScaleRow() -> NSView {
        let scale = NSSlider(value: context.theme.typography.sizeScale, minValue: 0.8, maxValue: 1.6,
                             target: self, action: #selector(scaleChanged(_:)))
        scale.isEnabled = context.isEditable
        scale.translatesAutoresizingMaskIntoConstraints = false
        scale.widthAnchor.constraint(equalToConstant: 160).isActive = true
        scaleLabel.stringValue = "\(Int((context.theme.typography.sizeScale * 100).rounded()))%"
        return row([captionLabel("Text size", 64), scale, scaleLabel])
    }

    private func makeRolesGrid() -> NSView {
        let grid = NSGridView()
        grid.rowSpacing = 8
        grid.columnSpacing = 8
        grid.addRow(with: [captionLabel("", 60), captionLabel("Size", 76),
                           captionLabel("Weight", 110), captionLabel("Font family", 150)])
        for role in TextRole.allCases {
            grid.addRow(with: typographyCells(role))
        }
        grid.column(at: 0).xPlacement = .leading
        return grid
    }

    private func typographyCells(_ role: TextRole) -> [NSView] {
        let editable = context.isEditable
        let style = context.theme.typography.style(role)
        let roleID = NSUserInterfaceItemIdentifier(role.rawValue)

        let sizeField = NSTextField()
        sizeField.doubleValue = style.size
        sizeField.identifier = roleID
        sizeField.target = self
        sizeField.action = #selector(typographyChanged(_:))
        sizeField.isEditable = editable
        sizeField.translatesAutoresizingMaskIntoConstraints = false
        sizeField.widthAnchor.constraint(equalToConstant: 48).isActive = true
        sizeFields[role] = sizeField

        let stepper = NSStepper()
        stepper.minValue = 8
        stepper.maxValue = 48
        stepper.increment = 1
        stepper.doubleValue = style.size
        stepper.identifier = roleID
        stepper.target = self
        stepper.action = #selector(sizeStepperChanged(_:))
        stepper.isEnabled = editable
        sizeSteppers[role] = stepper

        let weightPopup = NSPopUpButton()
        for weight in FontWeight.allCases {
            weightPopup.addItem(withTitle: weight.rawValue.capitalized)
            weightPopup.lastItem?.representedObject = weight
        }
        weightPopup.identifier = roleID
        weightPopup.target = self
        weightPopup.action = #selector(typographyChanged(_:))
        weightPopup.isEnabled = editable
        if let index = FontWeight.allCases.firstIndex(of: style.weight) {
            weightPopup.selectItem(at: index)
        }
        weightPopups[role] = weightPopup

        let familyField = NSTextField()
        familyField.stringValue = style.family ?? ""
        familyField.placeholderString = "System"
        familyField.identifier = roleID
        familyField.target = self
        familyField.action = #selector(typographyChanged(_:))
        familyField.isEditable = editable
        familyField.translatesAutoresizingMaskIntoConstraints = false
        familyField.widthAnchor.constraint(equalToConstant: 150).isActive = true
        familyFields[role] = familyField

        return [NSTextField(labelWithString: role.rawValue.capitalized),
                row([sizeField, stepper], spacing: 2), weightPopup, familyField]
    }

    // MARK: - Edits

    @objc private func scaleChanged(_ sender: NSSlider) {
        scaleLabel.stringValue = "\(Int((sender.doubleValue * 100).rounded()))%"
        context.update { $0.typography.sizeScale = sender.doubleValue }
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
        let size = max(8, min(48, sizeFields[role]?.doubleValue ?? ThemeTypography.defaultStyle(role).size))
        // Reflect the clamp back so the field/stepper show what's actually applied
        // (typing "100" lands on 48, not a stale out-of-range "100").
        sizeFields[role]?.doubleValue = size
        sizeSteppers[role]?.doubleValue = size
        let weight = (weightPopups[role]?.selectedItem?.representedObject as? FontWeight) ?? .regular
        let familyRaw = familyFields[role]?.stringValue.trimmingCharacters(in: .whitespaces) ?? ""
        let family = familyRaw.isEmpty ? nil : familyRaw
        let isMono = ThemeTypography.defaultStyle(role).monospaced
        context.update {
            $0.typography.styles[role.rawValue] = FontStyle(
                family: family, size: size, weight: weight, monospaced: isMono)
        }
    }
}
