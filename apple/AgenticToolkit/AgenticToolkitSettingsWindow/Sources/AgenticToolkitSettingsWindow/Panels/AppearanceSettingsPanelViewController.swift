import AppKit

/// Reusable Settings panel offering a theme picker (`AppearanceMode`) and a
/// text-size scale (`TextSize`). Persists choices via `UserDefaults`, applies
/// the selected `NSApp.appearance` immediately, and notifies the host via
/// `onTextSizeChange` so it can re-render any dependent UI.
@MainActor
public final class AppearanceSettingsPanelViewController: NSViewController, SettingsPanelViewController {

    /// UserDefaults keys used to persist the panel's three settings. Override
    /// to namespace per-app or to migrate from a legacy schema.
    public struct Keys: Sendable {
        public var appearanceMode: String
        public var followSystemTextSize: String
        public var textSize: String

        public init(
            appearanceMode: String = "appearanceMode",
            followSystemTextSize: String = "followSystemTextSize",
            textSize: String = "textSizeSetting"
        ) {
            self.appearanceMode = appearanceMode
            self.followSystemTextSize = followSystemTextSize
            self.textSize = textSize
        }
    }

    private let keys: Keys
    private let defaults: UserDefaults
    private let onTextSizeChange: (@MainActor (TextSize, _ followSystem: Bool) -> Void)?

    private var sizeStack: NSStackView?
    private var sizeValueLabel: NSTextField?

    public var listItem: SettingsPanelListItem {
        SettingsPanelListItem(
            title: "Appearance",
            image: NSImage(systemSymbolName: "paintbrush", accessibilityDescription: nil)
        )
    }

    public init(
        keys: Keys = Keys(),
        defaults: UserDefaults = .standard,
        onTextSizeChange: (@MainActor (TextSize, _ followSystem: Bool) -> Void)? = nil
    ) {
        self.keys = keys
        self.defaults = defaults
        self.onTextSizeChange = onTextSizeChange
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError()
    }

    public override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 400, height: 300))

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 16
        stack.alignment = .leading
        stack.translatesAutoresizingMaskIntoConstraints = false

        let themeRow = makeThemeRow()
        let followSystemCheckbox = makeFollowSystemCheckbox()
        let sizeStack = makeSizeStack()

        stack.addArrangedSubview(themeRow)
        stack.setCustomSpacing(20, after: themeRow)
        stack.addArrangedSubview(followSystemCheckbox)
        stack.addArrangedSubview(sizeStack)

        container.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: container.topAnchor, constant: 24),
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -24),
        ])

        self.view = container
    }

    private func makeThemeRow() -> NSStackView {
        let label = NSTextField(labelWithString: "Theme")
        label.font = .systemFont(ofSize: 13, weight: .semibold)

        let popup = NSPopUpButton()
        for mode in AppearanceMode.allCases {
            popup.addItem(withTitle: mode.label)
            popup.lastItem?.representedObject = mode.rawValue
        }
        let currentRaw = defaults.string(forKey: keys.appearanceMode) ?? AppearanceMode.auto.rawValue
        if let index = AppearanceMode.allCases.firstIndex(where: { $0.rawValue == currentRaw }) {
            popup.selectItem(at: index)
        }
        popup.target = self
        popup.action = #selector(themeChanged(_:))

        let row = NSStackView(views: [label, popup])
        row.orientation = .horizontal
        row.spacing = 8
        return row
    }

    private func makeFollowSystemCheckbox() -> NSButton {
        let checkbox = NSButton(
            checkboxWithTitle: "Follow system text size",
            target: self,
            action: #selector(followSystemChanged(_:))
        )
        let follow = (defaults.object(forKey: keys.followSystemTextSize) as? Bool) ?? true
        checkbox.state = follow ? .on : .off
        return checkbox
    }

    private func makeSizeStack() -> NSStackView {
        let allSizes = TextSize.allCases
        let slider = NSSlider(
            value: 2,
            minValue: 0,
            maxValue: Double(allSizes.count - 1),
            target: self,
            action: #selector(textSizeChanged(_:))
        )
        slider.numberOfTickMarks = allSizes.count
        slider.allowsTickMarkValuesOnly = true
        slider.translatesAutoresizingMaskIntoConstraints = false

        let currentRaw = defaults.string(forKey: keys.textSize) ?? TextSize.medium.rawValue
        if let index = allSizes.firstIndex(where: { $0.rawValue == currentRaw }) {
            slider.doubleValue = Double(index)
        }

        let valueLabel = NSTextField(labelWithString: TextSize(rawValue: currentRaw)?.label ?? "Medium")
        valueLabel.font = .systemFont(ofSize: 11)
        valueLabel.textColor = .secondaryLabelColor
        valueLabel.alignment = .center
        self.sizeValueLabel = valueLabel

        let smallA = NSTextField(labelWithString: "A")
        smallA.font = .systemFont(ofSize: 10)
        let bigA = NSTextField(labelWithString: "A")
        bigA.font = .systemFont(ofSize: 18)

        let sliderRow = NSStackView(views: [smallA, slider, bigA])
        sliderRow.orientation = .horizontal
        sliderRow.spacing = 6

        NSLayoutConstraint.activate([
            slider.widthAnchor.constraint(equalToConstant: 250),
        ])

        let stack = NSStackView(views: [sliderRow, valueLabel])
        stack.orientation = .vertical
        stack.spacing = 4
        stack.alignment = .centerX
        let follow = (defaults.object(forKey: keys.followSystemTextSize) as? Bool) ?? true
        stack.isHidden = follow
        self.sizeStack = stack
        return stack
    }

    // MARK: - Actions

    @objc private func themeChanged(_ sender: NSPopUpButton) {
        guard let raw = sender.selectedItem?.representedObject as? String,
              let mode = AppearanceMode(rawValue: raw) else { return }
        defaults.set(mode.rawValue, forKey: keys.appearanceMode)
        NSApp.appearance = mode.nsAppearance
    }

    @objc private func followSystemChanged(_ sender: NSButton) {
        let follow = sender.state == .on
        defaults.set(follow, forKey: keys.followSystemTextSize)
        sizeStack?.isHidden = follow
        notifyTextSizeChanged(followSystem: follow)
    }

    @objc private func textSizeChanged(_ sender: NSSlider) {
        let allSizes = TextSize.allCases
        let index = Int(sender.doubleValue.rounded())
        guard allSizes.indices.contains(index) else { return }
        let size = allSizes[index]
        defaults.set(size.rawValue, forKey: keys.textSize)
        sizeValueLabel?.stringValue = size.label
        notifyTextSizeChanged(followSystem: false)
    }

    private func notifyTextSizeChanged(followSystem: Bool) {
        guard let onTextSizeChange else { return }
        let raw = defaults.string(forKey: keys.textSize) ?? TextSize.medium.rawValue
        let size = TextSize(rawValue: raw) ?? .medium
        onTextSizeChange(size, followSystem)
    }
}
