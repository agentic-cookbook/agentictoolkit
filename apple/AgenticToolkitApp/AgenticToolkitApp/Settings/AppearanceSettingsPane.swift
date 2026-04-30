import AppKit
import Combine
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

final class AppearanceSettingsPane: NSView {
    private let viewModel: SettingsViewModel
    private var cancellables = Set<AnyCancellable>()

    init(viewModel: SettingsViewModel) {
        self.viewModel = viewModel
        super.init(frame: .zero)
        setupViews()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false

        let modeHeader = Self.makeHeader("Appearance")

        let lightRadio = NSButton(radioButtonWithTitle: "Light", target: self, action: #selector(modeChanged(_:)))
        lightRadio.tag = 0
        let darkRadio = NSButton(radioButtonWithTitle: "Dark", target: self, action: #selector(modeChanged(_:)))
        darkRadio.tag = 1
        let autoRadio = NSButton(radioButtonWithTitle: "Auto (System)", target: self, action: #selector(modeChanged(_:)))
        autoRadio.tag = 2

        switch viewModel.appearanceMode {
        case "light": lightRadio.state = .on
        case "dark": darkRadio.state = .on
        default: autoRadio.state = .on
        }

        let radioStack = NSStackView(views: [lightRadio, darkRadio, autoRadio])
        radioStack.orientation = .vertical
        radioStack.alignment = .leading
        radioStack.spacing = 4

        let divider = NSBox()
        divider.boxType = .separator

        let sizeHeader = Self.makeHeader("Text Size")

        let slider = NSSlider(value: viewModel.textSize, minValue: -4, maxValue: 4, target: self, action: #selector(textSizeChanged(_:)))
        slider.numberOfTickMarks = 9
        slider.allowsTickMarkValuesOnly = true
        slider.translatesAutoresizingMaskIntoConstraints = false

        let smallA = NSTextField(labelWithString: "A")
        smallA.font = .systemFont(ofSize: 10)
        smallA.textColor = .secondaryLabelColor

        let bigA = NSTextField(labelWithString: "A")
        bigA.font = .systemFont(ofSize: 18)
        bigA.textColor = .secondaryLabelColor

        let sliderRow = NSStackView(views: [smallA, slider, bigA])
        sliderRow.orientation = .horizontal
        sliderRow.spacing = 12

        let preview = NSTextField(labelWithString: "Example")
        preview.font = .systemFont(ofSize: max(9, 13 + viewModel.textSize))
        preview.alignment = .center
        preview.wantsLayer = true
        preview.layer?.backgroundColor = NSColor.quaternaryLabelColor.withAlphaComponent(0.3).cgColor
        preview.layer?.cornerRadius = 6
        preview.translatesAutoresizingMaskIntoConstraints = false

        stack.addArrangedSubview(modeHeader)
        stack.addArrangedSubview(radioStack)
        stack.addArrangedSubview(divider)
        stack.addArrangedSubview(sizeHeader)
        stack.addArrangedSubview(sliderRow)
        stack.addArrangedSubview(preview)

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
            divider.widthAnchor.constraint(equalTo: stack.widthAnchor),
            sliderRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            preview.widthAnchor.constraint(equalTo: stack.widthAnchor),
            preview.heightAnchor.constraint(equalToConstant: 32)
        ])
    }

    private static func makeHeader(_ title: String) -> NSTextField {
        let label = NSTextField(labelWithString: title)
        label.font = .boldSystemFont(ofSize: NSFont.systemFontSize)
        return label
    }

    @objc private func modeChanged(_ sender: NSButton) {
        let mode: String
        switch sender.tag {
        case 0: mode = "light"
        case 1: mode = "dark"
        default: mode = "auto"
        }
        viewModel.appearanceMode = mode
    }

    @objc private func textSizeChanged(_ sender: NSSlider) {
        viewModel.textSize = sender.doubleValue
    }
}
