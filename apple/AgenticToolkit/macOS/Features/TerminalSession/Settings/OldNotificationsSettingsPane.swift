//
//  OldNotificationsSettingsPane.swift
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


final class OldNotificationsSettingsPane: OldSettingsPanelView {
    private let viewModel: WhippetSettingsViewModel

    init(viewModel: WhippetSettingsViewModel) {
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
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false

        stack.addArrangedSubview(Self.makeHeader("Notify When"))

        let startToggle = NSButton(checkboxWithTitle: "Session Started", target: self, action: #selector(startChanged(_:)))
        startToggle.state = viewModel.notifySessionStart ? .on : .off

        let endToggle = NSButton(checkboxWithTitle: "Session Ended", target: self, action: #selector(endChanged(_:)))
        endToggle.state = viewModel.notifySessionEnd ? .on : .off

        let staleToggle = NSButton(checkboxWithTitle: "Session Became Stale", target: self, action: #selector(staleChanged(_:)))
        staleToggle.state = viewModel.notifyStale ? .on : .off

        let hint = NSTextField(labelWithString: "Notifications require permission. macOS will prompt you on first use.")
        hint.font = .systemFont(ofSize: 11)
        hint.textColor = .secondaryLabelColor

        stack.addArrangedSubview(startToggle)
        stack.addArrangedSubview(endToggle)
        stack.addArrangedSubview(staleToggle)

        let spacer = NSView()
        spacer.translatesAutoresizingMaskIntoConstraints = false
        spacer.heightAnchor.constraint(equalToConstant: 12).isActive = true
        stack.addArrangedSubview(spacer)
        stack.addArrangedSubview(hint)

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -20),
        ])
    }

    @objc private func startChanged(_ sender: NSButton) { viewModel.notifySessionStart = sender.state == .on }
    @objc private func endChanged(_ sender: NSButton) { viewModel.notifySessionEnd = sender.state == .on }
    @objc private func staleChanged(_ sender: NSButton) { viewModel.notifyStale = sender.state == .on }
}
