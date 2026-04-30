//
//  OldSessionWindowSettingsPane.swift
//  Whippet
//
//  Created by Mike Fullerton on 4/27/26.
//

import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

import AppKit
import Combine

final class OldSessionWindowSettingsPane: OldSettingsPanelView {
    private let viewModel: WhippetSettingsViewModel
    private var cancellables = Set<AnyCancellable>()
    private let percentLabel = NSTextField(labelWithString: "")
    private let timeoutValueLabel = NSTextField(labelWithString: "")
    private let customCommandContainer = NSStackView()

    init(viewModel: WhippetSettingsViewModel) {
        self.viewModel = viewModel
        super.init(frame: .zero)
        setupViews()
        bindViewModel()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false

        // --- Window Behavior ---
        let windowHeader = Self.makeHeader("Window Behavior")
        let toggle = NSButton(checkboxWithTitle: "Always on Top", target: self, action: #selector(alwaysOnTopChanged(_:)))
        toggle.state = viewModel.alwaysOnTop ? .on : .off

        let divider1 = NSBox()
        divider1.boxType = .separator

        // --- Transparency ---
        let transHeader = Self.makeHeader("Transparency")

        let transSlider = NSSlider(value: viewModel.transparency, minValue: 0.3, maxValue: 1.0, target: self, action: #selector(transparencyChanged(_:)))
        transSlider.translatesAutoresizingMaskIntoConstraints = false

        percentLabel.stringValue = "\(Int(viewModel.transparency * 100))%"
        percentLabel.textColor = .secondaryLabelColor
        percentLabel.font = .monospacedDigitSystemFont(ofSize: 13, weight: .regular)
        percentLabel.setContentCompressionResistancePriority(.required, for: .horizontal)

        let transRow = NSStackView(views: [transSlider, percentLabel])
        transRow.orientation = .horizontal
        transRow.spacing = 8

        let divider2 = NSBox()
        divider2.boxType = .separator

        // --- Staleness Timeout ---
        let timeoutHeader = Self.makeHeader("Staleness Timeout")

        let timeoutSlider = NSSlider(value: viewModel.stalenessTimeout, minValue: 30, maxValue: 600, target: self, action: #selector(timeoutChanged(_:)))
        timeoutSlider.translatesAutoresizingMaskIntoConstraints = false

        timeoutValueLabel.stringValue = viewModel.stalenessTimeoutDisplay
        timeoutValueLabel.textColor = .secondaryLabelColor
        timeoutValueLabel.font = .monospacedDigitSystemFont(ofSize: 13, weight: .regular)
        timeoutValueLabel.setContentCompressionResistancePriority(.required, for: .horizontal)

        let timeoutRow = NSStackView(views: [timeoutSlider, timeoutValueLabel])
        timeoutRow.orientation = .horizontal
        timeoutRow.spacing = 8

        let timeoutHint = NSTextField(labelWithString: "Sessions with no events within this timeout are marked as stale.")
        timeoutHint.font = .systemFont(ofSize: 11)
        timeoutHint.textColor = .secondaryLabelColor

        let divider3 = NSBox()
        divider3.boxType = .separator

        // --- Click Action ---
        let actionHeader = Self.makeHeader("Click Action")

        let popup = NSPopUpButton()
        for action in SessionWatcherClickAction.allCases {
            let item = NSMenuItem(title: action.displayName, action: nil, keyEquivalent: "")
            item.image = NSImage(systemSymbolName: action.systemImage, accessibilityDescription: nil)
            item.representedObject = action
            popup.menu?.addItem(item)
        }
        popup.selectItem(at: SessionWatcherClickAction.allCases.firstIndex(of: viewModel.clickAction) ?? 0)
        popup.target = self
        popup.action = #selector(actionChanged(_:))

        // Custom command section (conditionally visible)
        customCommandContainer.orientation = .vertical
        customCommandContainer.alignment = .leading
        customCommandContainer.spacing = 8
        customCommandContainer.translatesAutoresizingMaskIntoConstraints = false

        let cmdDivider = NSBox()
        cmdDivider.boxType = .separator

        let cmdHeader = Self.makeHeader("Shell Command Template")

        let cmdField = NSTextField()
        cmdField.stringValue = viewModel.customCommand
        cmdField.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        cmdField.placeholderString = "Command..."
        cmdField.target = self
        cmdField.action = #selector(customCommandChanged(_:))
        cmdField.translatesAutoresizingMaskIntoConstraints = false

        let cmdHint = NSTextField(labelWithString: "Available variables: $SESSION_ID, $CWD, $MODEL")
        cmdHint.font = .systemFont(ofSize: 11)
        cmdHint.textColor = .secondaryLabelColor

        customCommandContainer.addArrangedSubview(cmdDivider)
        customCommandContainer.addArrangedSubview(cmdHeader)
        customCommandContainer.addArrangedSubview(cmdField)
        customCommandContainer.addArrangedSubview(cmdHint)
        customCommandContainer.isHidden = viewModel.clickAction != .customCommand

        let divider4 = NSBox()
        divider4.boxType = .separator

        // --- Session Summaries ---
        let summaryHeader = Self.makeHeader("Session Summaries")

        let enableToggle = NSButton()
        enableToggle.setButtonType(.switch)
        enableToggle.title = "Enable AI session summaries"
        enableToggle.state = viewModel.aiSummariesEnabled ? .on : .off
        enableToggle.target = self
        enableToggle.action = #selector(summariesEnableChanged(_:))

        let enableHint = NSTextField(labelWithString: "Uses AI to generate a short description of what each session is doing.")
        enableHint.font = .systemFont(ofSize: 11)
        enableHint.textColor = .secondaryLabelColor

        // --- Assemble ---
        stack.addArrangedSubview(windowHeader)
        stack.addArrangedSubview(toggle)
        stack.addArrangedSubview(divider1)
        stack.addArrangedSubview(transHeader)
        stack.addArrangedSubview(transRow)
        stack.addArrangedSubview(divider2)
        stack.addArrangedSubview(timeoutHeader)
        stack.addArrangedSubview(timeoutRow)
        stack.addArrangedSubview(timeoutHint)
        stack.addArrangedSubview(divider3)
        stack.addArrangedSubview(actionHeader)
        stack.addArrangedSubview(popup)
        stack.addArrangedSubview(customCommandContainer)
        stack.addArrangedSubview(divider4)
        stack.addArrangedSubview(summaryHeader)
        stack.addArrangedSubview(enableToggle)
        stack.addArrangedSubview(enableHint)

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -20),
            divider1.widthAnchor.constraint(equalTo: stack.widthAnchor),
            divider2.widthAnchor.constraint(equalTo: stack.widthAnchor),
            divider3.widthAnchor.constraint(equalTo: stack.widthAnchor),
            divider4.widthAnchor.constraint(equalTo: stack.widthAnchor),
            transRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            timeoutRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            percentLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 40),
            timeoutValueLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 80),
            cmdDivider.widthAnchor.constraint(equalTo: customCommandContainer.widthAnchor),
            cmdField.widthAnchor.constraint(equalTo: customCommandContainer.widthAnchor)
        ])
    }

    private func bindViewModel() {
        viewModel.$clickAction
            .receive(on: DispatchQueue.main)
            .sink { [weak self] action in
                self?.customCommandContainer.isHidden = action != .customCommand
            }
            .store(in: &cancellables)
    }

    @objc private func alwaysOnTopChanged(_ sender: NSButton) {
        viewModel.alwaysOnTop = sender.state == .on
    }

    @objc private func transparencyChanged(_ sender: NSSlider) {
        let rounded = (sender.doubleValue / 0.05).rounded() * 0.05
        viewModel.transparency = rounded
        percentLabel.stringValue = "\(Int(viewModel.transparency * 100))%"
    }

    @objc private func timeoutChanged(_ sender: NSSlider) {
        let rounded = (sender.doubleValue / 10).rounded() * 10
        viewModel.stalenessTimeout = rounded
        timeoutValueLabel.stringValue = viewModel.stalenessTimeoutDisplay
    }

    @objc private func actionChanged(_ sender: NSPopUpButton) {
        guard let item = sender.selectedItem,
              let action = item.representedObject as? SessionWatcherClickAction else { return }
        viewModel.clickAction = action
    }

    @objc private func customCommandChanged(_ sender: NSTextField) {
        viewModel.customCommand = sender.stringValue
    }

    @objc private func summariesEnableChanged(_ sender: NSButton) {
        viewModel.aiSummariesEnabled = sender.state == .on
    }
}
