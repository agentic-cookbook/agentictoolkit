import AppKit
import Combine
import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS
import AIPluginKit

/// The "LLM Providers" settings panel — a topic/detail split (like "Theme") with
/// one sub-panel per configured provider. The sidebar lists the configurations
/// (titled "Providers" and themed by the framework); selecting one shows its
/// editor in the detail, whose title is the configuration's name. A footer under
/// the list carries add (`+`, opens the provider picker) / remove (`−`).
@MainActor
open class AIPanelViewController: ComposableSettings.SettingsPanelSplitViewController {

    public let pluginManager: AIPluginManager
    private let viewModel: LLMProvidersListViewModel
    private var addRemoveControl: NSSegmentedControl?
    private var selectionObserver: AnyCancellable?

    public init(pluginManager: AIPluginManager) {
        self.pluginManager = pluginManager
        self.viewModel = LLMProvidersListViewModel(pluginManager: pluginManager)
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "LLM Providers",
            icon: NSImage(systemSymbolName: "cpu", accessibilityDescription: nil)
        ))
        // The sidebar lists multiple provider configurations, so title it in plural.
        sidebarTitle = "Providers"
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        listViewController.setFooterView(makeFooter())

        viewModel.onRequestAddProvider = { [weak self] in
            guard let self, let window = self.view.window else { return }
            ProviderPicker.present(over: window, rows: self.viewModel.pickerRows) { [weak self] available in
                guard let self else { return }
                self.viewModel.add(available)            // sets selectedId to the new config
                self.rebuildPanels(selecting: self.viewModel.selectedId)
            }
        }

        rebuildPanels(selecting: viewModel.selectedId ?? viewModel.configurations.first?.id)

        // Enable the remove(−) segment only when a configuration is selected.
        selectionObserver = viewModel.$selectedId.sink { [weak self] id in
            self?.addRemoveControl?.setEnabled(id != nil, forSegment: 1)
        }
    }

    /// Rebuilds one detail panel per configuration and selects `selectID`. Called
    /// on load and after any structural change (add / remove).
    private func rebuildPanels(selecting selectID: UUID?) {
        let configs = viewModel.configurations
        let panels = configs.map { config in
            ProviderConfigPanelViewController(
                config: config,
                viewModel: viewModel,
                onRenamed: { [weak self] in self?.refreshRows() }
            )
        }
        setPanels(panels)
        if let index = configs.firstIndex(where: { $0.id == selectID }) {
            selectPanel(at: index)
        } else if !panels.isEmpty {
            selectPanel(at: 0)
        }
    }

    // MARK: - Scripted / testable selection

    /// The names of the configured providers, in sidebar order.
    public var configurationNames: [String] {
        panels.compactMap { $0.descriptor.title }
    }

    /// Selects the provider configuration with the given name (its sidebar title),
    /// driving both the list highlight and the detail editor. Enables scripted /
    /// UI-test navigation of the inner Providers list, which — being a custom
    /// themed table — doesn't reliably respond to synthetic clicks. Returns false
    /// when no configuration has that name.
    @discardableResult
    public func selectConfiguration(named name: String) -> Bool {
        guard let index = panels.firstIndex(where: { $0.descriptor.title == name }) else { return false }
        selectPanel(at: index)
        return true
    }

    /// The test-chat view model of the currently-selected configuration (nil if
    /// none is selected). Lets automation drive the embedded chat, whose text
    /// field — nested in a hosted SwiftUI view — doesn't take synthetic input.
    var selectedChatViewModel: ChatViewModel? {
        guard let id = viewModel.selectedId else { return nil }
        return panels.compactMap { $0 as? ProviderConfigPanelViewController }
            .first { $0.config.id == id }?.chatSession.viewModel
    }

    /// Sends a message through the selected configuration's test chat. Returns
    /// false when no configuration is selected.
    @discardableResult
    public func sendTestMessage(_ text: String) -> Bool {
        guard let viewModel = selectedChatViewModel else { return false }
        viewModel.sendMessage(text)
        return true
    }

    /// The selected configuration's test-chat transcript as newline-separated
    /// `role: text` lines (empty when nothing is selected).
    public func testChatTranscript() -> String {
        guard let viewModel = selectedChatViewModel else { return "" }
        return viewModel.messages.map { message in
            let role: String
            switch message.role {
            case .user: role = "user"
            case .assistant: role = "assistant"
            case .error: role = "error"
            case .notice: role = "notice"
            }
            return "\(role): \(message.text)"
        }.joined(separator: "\n")
    }

    /// Re-reads the sidebar row titles from the existing panels after an in-place
    /// rename, without recreating them, then keeps the selected row highlighted.
    private func refreshRows() {
        listViewController.setPanels(panels)
        if let index = viewModel.configurations.firstIndex(where: { $0.id == viewModel.selectedId }) {
            listViewController.selectPanel(at: index)
        }
    }

    // MARK: - Footer

    private func makeFooter() -> NSView {
        let addRemove = NSSegmentedControl()
        addRemove.segmentCount = 2
        let plus = NSImage(systemSymbolName: "plus", accessibilityDescription: "Add provider")
        let minus = NSImage(systemSymbolName: "minus", accessibilityDescription: "Remove provider")
        addRemove.setImage(plus, forSegment: 0)
        addRemove.setImage(minus, forSegment: 1)
        addRemove.setWidth(28, forSegment: 0)
        addRemove.setWidth(28, forSegment: 1)
        addRemove.trackingMode = .momentary
        addRemove.segmentStyle = .smallSquare
        addRemove.target = self
        addRemove.action = #selector(addRemoveClicked(_:))
        addRemove.setToolTip("Add a provider", forSegment: 0)
        addRemove.setToolTip("Remove the selected provider", forSegment: 1)
        addRemove.setEnabled(viewModel.selectedId != nil, forSegment: 1)
        addRemoveControl = addRemove

        let bar = NSStackView()
        bar.orientation = .horizontal
        bar.edgeInsets = NSEdgeInsets(top: 6, left: 8, bottom: 6, right: 8)
        bar.spacing = 6
        bar.addView(addRemove, in: .leading)
        bar.translatesAutoresizingMaskIntoConstraints = false

        let separator = ThemedSeparatorView(role: .border)
        let footer = NSStackView(views: [separator, bar])
        footer.orientation = .vertical
        footer.alignment = .leading
        footer.spacing = 0
        footer.translatesAutoresizingMaskIntoConstraints = false
        for sub in [separator, bar] {
            sub.widthAnchor.constraint(equalTo: footer.widthAnchor).isActive = true
        }
        return footer
    }

    @objc private func addRemoveClicked(_ sender: NSSegmentedControl) {
        switch sender.selectedSegment {
        case 0: viewModel.onRequestAddProvider?()
        case 1: removeSelected()
        default: break
        }
    }

    private func removeSelected() {
        guard let id = viewModel.selectedId,
              let config = viewModel.configurations.first(where: { $0.id == id }) else {
            NSSound.beep()
            return
        }
        let alert = NSAlert()
        alert.messageText = "Delete “\(config.name)”?"
        alert.informativeText = "This removes the configuration and its stored settings, including any API key."
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Delete")
        alert.addButton(withTitle: "Cancel")
        alert.buttons.first?.hasDestructiveAction = true

        let confirmDelete: () -> Void = { [weak self] in
            guard let self else { return }
            // Land on the previous row (or the first) after the delete.
            let ids = self.viewModel.configurations.map(\.id)
            let previous = ids.firstIndex(of: id).flatMap { $0 > 0 ? ids[$0 - 1] : nil }
            self.viewModel.remove(id)
            self.rebuildPanels(selecting: previous ?? self.viewModel.configurations.first?.id)
        }

        if let window = view.window {
            alert.beginSheetModal(for: window) { response in
                if response == .alertFirstButtonReturn { confirmDelete() }
            }
        } else if alert.runModal() == .alertFirstButtonReturn {
            confirmDelete()
        }
    }
}

/// One configuration's detail panel: its title (the config name) is the sidebar
/// row label + detail-pane title; its body is the SwiftUI editor.
@MainActor
private final class ProviderConfigPanelViewController: ComposableSettings.SettingsPanelViewController {

    let config: AIProviderConfiguration
    /// The chat test session for this configuration, owned here so it's reachable
    /// for scripted tests (see `AIPanelViewController.selectedChatViewModel`).
    let chatSession: ChatSession
    private let viewModel: LLMProvidersListViewModel
    private let onRenamed: () -> Void
    private var nameObserver: AnyCancellable?

    /// The editor scrolls its own chat area, so host it directly rather than
    /// wrapping it in the framework's scroll view.
    var hostsOwnScroll: Bool { true }

    init(config: AIProviderConfiguration, viewModel: LLMProvidersListViewModel, onRenamed: @escaping () -> Void) {
        self.config = config
        self.chatSession = ChatSession(configuration: config, pluginManager: viewModel.pluginManager)
        self.viewModel = viewModel
        self.onRenamed = onRenamed
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: config.name,
            icon: NSImage(systemSymbolName: "cpu", accessibilityDescription: nil)
        ))
        // Keep the sidebar row title + detail title in sync when this config is
        // renamed in the editor.
        nameObserver = viewModel.$configurations
            .compactMap { configs in configs.first(where: { $0.id == config.id })?.name }
            .removeDuplicates()
            .sink { [weak self] name in
                guard let self, self.descriptor.title != name else { return }
                self.descriptor.title = name
                self.onRenamed()
            }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func loadView() {
        let editor = LLMProviderEditorView(configuration: config, viewModel: viewModel, chat: chatSession)
        let hosting = NSHostingView(rootView: editor)
        hosting.translatesAutoresizingMaskIntoConstraints = false
        self.view = hosting
    }

    override func viewWillAppear() {
        super.viewWillAppear()
        // Selecting this row shows this panel — record it as the active selection
        // (drives the footer's remove target).
        viewModel.selectedId = config.id
    }
}
