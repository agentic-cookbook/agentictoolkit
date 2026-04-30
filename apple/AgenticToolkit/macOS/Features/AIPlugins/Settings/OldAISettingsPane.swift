//
//  AISettingsPane.swift
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

final class AISettingsPane: OldSettingsPanelView {
    private let viewModel: WhippetSettingsViewModel
    private let chatViewModel: ChatViewModel
    private var cancellables = Set<AnyCancellable>()

    private let providerPopup = NSPopUpButton()
    private let modelPopup = NSPopUpButton()
    private let modelField = NSTextField()
    private let apiKeyField = NSSecureTextField()
    private let maskedKeyRow = NSStackView()
    private let testButton = NSButton(title: "Test API Key", target: nil, action: nil)
    private let testStatusLabel = NSTextField(labelWithString: "")
    private let testSpinner = NSProgressIndicator()
    private let apiKeyContainer = NSStackView()
    private let baseURLContainer = NSStackView()
    private let baseURLField = NSTextField()
    private let recommendedStack = NSStackView()

    init(viewModel: WhippetSettingsViewModel) {
        self.viewModel = viewModel

        let aiConfig = AIModelChatConfig(aiProvider: .anthropic, aiModel: "", aiBaseURL: "", apiKey: "", aiSummariesEnabled: false)

        let backend = WhippetChatBackend(aiInfo: aiConfig)
        self.chatViewModel = ChatViewModel(backend: backend)
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

        // Provider
        stack.addArrangedSubview(Self.makeHeader("Provider"))
        for provider in AIProvider.allCases {
            providerPopup.addItem(withTitle: provider.displayName)
            providerPopup.lastItem?.representedObject = provider
        }
        providerPopup.selectItem(at: AIProvider.allCases.firstIndex(of: viewModel.aiProvider) ?? 0)
        providerPopup.target = self
        providerPopup.action = #selector(providerChanged(_:))
        stack.addArrangedSubview(providerPopup)

        // Model
        stack.addArrangedSubview(Self.makeHeader("Model"))
        updateModelPopup()
        modelPopup.target = self
        modelPopup.action = #selector(modelPopupChanged(_:))
        stack.addArrangedSubview(modelPopup)

        modelField.stringValue = viewModel.aiModel
        modelField.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        modelField.placeholderString = "Or type a model name"
        modelField.target = self
        modelField.action = #selector(modelFieldChanged(_:))
        modelField.translatesAutoresizingMaskIntoConstraints = false
        stack.addArrangedSubview(modelField)

        // Recommended note
        recommendedStack.orientation = .horizontal
        recommendedStack.spacing = 4
        recommendedStack.translatesAutoresizingMaskIntoConstraints = false
        updateRecommendedNote()
        stack.addArrangedSubview(recommendedStack)

        // API Key container (hidden when using Claude CLI)
        apiKeyContainer.orientation = .vertical
        apiKeyContainer.alignment = .leading
        apiKeyContainer.spacing = 8
        apiKeyContainer.translatesAutoresizingMaskIntoConstraints = false

        apiKeyContainer.addArrangedSubview(makeSeparator())
        apiKeyContainer.addArrangedSubview(Self.makeHeader("API Key"))

        // Masked key row (when key exists in keychain)
        maskedKeyRow.orientation = .horizontal
        maskedKeyRow.spacing = 8
        maskedKeyRow.translatesAutoresizingMaskIntoConstraints = false
        let maskedLabel = NSTextField(labelWithString: "\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}")
        maskedLabel.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        maskedLabel.textColor = .secondaryLabelColor
        let clearButton = NSButton(title: "Clear", target: self, action: #selector(clearAPIKey))
        clearButton.controlSize = .small
        maskedKeyRow.addArrangedSubview(maskedLabel)
        let maskedSpacer = NSView()
        maskedSpacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        maskedKeyRow.addArrangedSubview(maskedSpacer)
        maskedKeyRow.addArrangedSubview(clearButton)
        maskedKeyRow.isHidden = !(viewModel.hasStoredAPIKey && viewModel.aiAPIKey.isEmpty)
        apiKeyContainer.addArrangedSubview(maskedKeyRow)

        apiKeyField.placeholderString = viewModel.hasStoredAPIKey ? "Enter new key to replace" : viewModel.aiProvider.apiKeyPlaceholder
        apiKeyField.target = self
        apiKeyField.action = #selector(apiKeyChanged(_:))
        apiKeyField.translatesAutoresizingMaskIntoConstraints = false
        apiKeyContainer.addArrangedSubview(apiKeyField)

        // Test button row
        testButton.target = self
        testButton.action = #selector(testAPIKeyClicked)
        testButton.controlSize = .small

        testSpinner.style = .spinning
        testSpinner.controlSize = .small
        testSpinner.isHidden = true

        testStatusLabel.font = .systemFont(ofSize: 11)
        testStatusLabel.textColor = .secondaryLabelColor

        let testRow = NSStackView(views: [testButton, testSpinner, testStatusLabel])
        testRow.orientation = .horizontal
        testRow.spacing = 8
        apiKeyContainer.addArrangedSubview(testRow)

        apiKeyContainer.isHidden = viewModel.aiProvider.usesCLI
        stack.addArrangedSubview(apiKeyContainer)

        // Custom base URL (only for custom provider)
        baseURLContainer.orientation = .vertical
        baseURLContainer.alignment = .leading
        baseURLContainer.spacing = 8
        baseURLContainer.translatesAutoresizingMaskIntoConstraints = false

        baseURLContainer.addArrangedSubview(Self.makeHeader("Base URL"))
        baseURLField.stringValue = viewModel.aiBaseURL
        baseURLField.placeholderString = "https://api.example.com"
        baseURLField.target = self
        baseURLField.action = #selector(baseURLChanged(_:))
        baseURLField.translatesAutoresizingMaskIntoConstraints = false
        baseURLContainer.addArrangedSubview(baseURLField)

        let urlHint = NSTextField(labelWithString: "OpenAI-compatible API endpoint. Must support /v1/chat/completions.")
        urlHint.font = .systemFont(ofSize: 11)
        urlHint.textColor = .secondaryLabelColor
        baseURLContainer.addArrangedSubview(urlHint)
        baseURLContainer.isHidden = viewModel.aiProvider != .custom
        stack.addArrangedSubview(baseURLContainer)

        stack.addArrangedSubview(makeSeparator())

        // Quick Chat
        let chatHeaderRow = NSStackView()
        chatHeaderRow.orientation = .horizontal
        chatHeaderRow.spacing = 8
        chatHeaderRow.translatesAutoresizingMaskIntoConstraints = false
        let chatHeader = Self.makeHeader("Quick Chat")
        let chatClearButton = NSButton(title: "Clear", target: self, action: #selector(clearChat))
        chatClearButton.controlSize = .small
        chatClearButton.isBordered = false
        chatClearButton.font = .systemFont(ofSize: 11)
        chatHeaderRow.addArrangedSubview(chatHeader)
        let chatSpacer = NSView()
        chatSpacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        chatHeaderRow.addArrangedSubview(chatSpacer)
        chatHeaderRow.addArrangedSubview(chatClearButton)
        stack.addArrangedSubview(chatHeaderRow)

        let chatView = ChatView(viewModel: chatViewModel)
        chatView.translatesAutoresizingMaskIntoConstraints = false
        stack.addArrangedSubview(chatView)

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -20),
            modelField.widthAnchor.constraint(equalTo: stack.widthAnchor),
            apiKeyContainer.widthAnchor.constraint(equalTo: stack.widthAnchor),
            apiKeyField.widthAnchor.constraint(equalTo: apiKeyContainer.widthAnchor),
            maskedKeyRow.widthAnchor.constraint(equalTo: apiKeyContainer.widthAnchor),
            baseURLField.widthAnchor.constraint(equalTo: baseURLContainer.widthAnchor),
            chatHeaderRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            chatView.widthAnchor.constraint(equalTo: stack.widthAnchor),
            chatView.heightAnchor.constraint(greaterThanOrEqualToConstant: 240)
        ])
    }

    private func bindViewModel() {
        viewModel.$apiKeyTestState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.updateTestState(state)
            }
            .store(in: &cancellables)

        viewModel.$aiProvider
            .receive(on: DispatchQueue.main)
            .sink { [weak self] provider in
                self?.apiKeyContainer.isHidden = provider.usesCLI
                self?.baseURLContainer.isHidden = provider != .custom
                self?.updateModelPopup()
                self?.updateRecommendedNote()
            }
            .store(in: &cancellables)

        viewModel.$hasStoredAPIKey
            .combineLatest(viewModel.$aiAPIKey)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] hasKey, fieldKey in
                self?.maskedKeyRow.isHidden = !(hasKey && fieldKey.isEmpty)
            }
            .store(in: &cancellables)
    }

    private func updateModelPopup() {
        modelPopup.removeAllItems()
        let models = viewModel.aiProvider.defaultModels
        if models.isEmpty {
            modelPopup.isHidden = true
        } else {
            modelPopup.isHidden = false
            for model in models {
                modelPopup.addItem(withTitle: model)
            }
            modelPopup.selectItem(withTitle: viewModel.aiModel)
        }
    }

    private func updateRecommendedNote() {
        recommendedStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let note = viewModel.aiProvider.recommendedNote
        guard !note.isEmpty else {
            recommendedStack.isHidden = true
            return
        }
        recommendedStack.isHidden = false

        let star = NSImageView()
        star.image = NSImage(systemSymbolName: "star.fill", accessibilityDescription: nil)
        star.symbolConfiguration = .init(pointSize: 9, weight: .regular)
        star.contentTintColor = .systemYellow
        recommendedStack.addArrangedSubview(star)

        let label = NSTextField(labelWithString: "Recommended: \(note)")
        label.font = .systemFont(ofSize: 11)
        label.textColor = .secondaryLabelColor
        recommendedStack.addArrangedSubview(label)

        if viewModel.aiModel != viewModel.aiProvider.recommendedModel {
            let useButton = NSButton(title: "Use recommended", target: self, action: #selector(useRecommended))
            useButton.font = .systemFont(ofSize: 11)
            useButton.isBordered = false
            useButton.contentTintColor = .controlAccentColor
            recommendedStack.addArrangedSubview(useButton)
        }
    }

    private func updateTestState(_ state: APIKeyTestState) {
        switch state {
        case .idle:
            testSpinner.isHidden = true
            testSpinner.stopAnimation(nil)
            testStatusLabel.stringValue = ""
        case .testing:
            testSpinner.isHidden = false
            testSpinner.startAnimation(nil)
            testStatusLabel.stringValue = "Testing..."
            testStatusLabel.textColor = .secondaryLabelColor
        case .success:
            testSpinner.isHidden = true
            testSpinner.stopAnimation(nil)
            testStatusLabel.stringValue = "API key is valid"
            testStatusLabel.textColor = .systemGreen
        case .failed(let message):
            testSpinner.isHidden = true
            testSpinner.stopAnimation(nil)
            testStatusLabel.stringValue = message
            testStatusLabel.textColor = .systemRed
        }
    }

    private func makeSeparator() -> NSBox {
        let sep = NSBox()
        sep.boxType = .separator
        sep.translatesAutoresizingMaskIntoConstraints = false
        return sep
    }

    @objc private func providerChanged(_ sender: NSPopUpButton) {
        guard let provider = sender.selectedItem?.representedObject as? AIProvider else { return }
        viewModel.aiProvider = provider
    }
    @objc private func modelPopupChanged(_ sender: NSPopUpButton) {
        guard let title = sender.selectedItem?.title else { return }
        viewModel.aiModel = title
        modelField.stringValue = title
    }
    @objc private func modelFieldChanged(_ sender: NSTextField) { viewModel.aiModel = sender.stringValue }
    @objc private func apiKeyChanged(_ sender: NSTextField) { viewModel.aiAPIKey = sender.stringValue }
    @objc private func clearAPIKey() { viewModel.clearAPIKey() }
    @objc private func testAPIKeyClicked() { viewModel.testAPIKey() }
    @objc private func baseURLChanged(_ sender: NSTextField) { viewModel.aiBaseURL = sender.stringValue }
    @objc private func useRecommended() {
        viewModel.aiModel = viewModel.aiProvider.recommendedModel
        modelField.stringValue = viewModel.aiModel
        modelPopup.selectItem(withTitle: viewModel.aiModel)
        updateRecommendedNote()
    }
    @objc private func clearChat() { chatViewModel.clearHistory() }
}

/// The state of an API key validation test.
enum APIKeyTestState: Equatable {
    case idle
    case testing
    case success
    case failed(String)
}
