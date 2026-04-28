//
//  OldGeneralSettingsPane.swift
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


final class OldGeneralSettingsPane: OldSettingsPanelView {
    private let viewModel: WhippetSettingsViewModel
    private var cancellables = Set<AnyCancellable>()
    private let promptContainer = NSStackView()

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
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false

        stack.addArrangedSubview(Self.makeHeader("Startup"))

        let loginToggle = NSButton(checkboxWithTitle: "Launch at Login", target: self, action: #selector(launchAtLoginChanged(_:)))
        loginToggle.state = viewModel.launchAtLogin ? .on : .off
        stack.addArrangedSubview(loginToggle)

        promptContainer.orientation = .vertical
        promptContainer.alignment = .leading
        promptContainer.spacing = 8
        promptContainer.translatesAutoresizingMaskIntoConstraints = false

        let promptText = NSTextField(wrappingLabelWithString:
            "Whippet works best when it starts automatically with your Mac. Enable launch at login so you never miss a Claude Code session.")
        promptText.font = .systemFont(ofSize: 12)
        promptText.textColor = .secondaryLabelColor

        let gotItButton = NSButton(title: "Got It", target: self, action: #selector(dismissPrompt))
        gotItButton.bezelStyle = .rounded
        gotItButton.controlSize = .small

        promptContainer.addArrangedSubview(promptText)
        promptContainer.addArrangedSubview(gotItButton)
        promptContainer.isHidden = !viewModel.shouldShowLaunchAtLoginPrompt
        stack.addArrangedSubview(promptContainer)

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -20),
        ])
    }

    private func bindViewModel() {
        viewModel.$shouldShowLaunchAtLoginPrompt
            .receive(on: DispatchQueue.main)
            .sink { [weak self] show in
                self?.promptContainer.isHidden = !show
            }
            .store(in: &cancellables)
    }

    @objc private func launchAtLoginChanged(_ sender: NSButton) {
        viewModel.launchAtLogin = sender.state == .on
    }

    @objc private func dismissPrompt() {
        viewModel.dismissLaunchAtLoginPrompt()
    }
}
