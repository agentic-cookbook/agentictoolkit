import AppKit

/// Base class for every settings panel. One instance is hosted in the
/// right-hand detail pane of a `SettingsSplitViewController`; the sidebar metadata
/// lives on the panel itself via the open overrides below. The panel *is* the
/// list item — no wrapper struct.
@MainActor
open class ComposableSettingsPanelViewController: NSViewController {

    /// This is what is user for the settings panel list
    public let descriptor: any SettingsPanelDescribing

    open override func loadView() {
        self.view = ComposableSettingsPanelView()
    }
    
    public init(topicItem: any SettingsPanelDescribing) {
        self.descriptor = descriptor
        super.init(nibName: nil, bundle: nil)
    }
    
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

@MainActor
public protocol SettingsPanelDescribing: TopicListItemProtocol {
    var category: String? { get }
}

public struct SettingsPanelDescriptor: SettingsPanelDescribing {
    public let title: String
    public let icon: NSImage
    public let category: String? = nil
    public let isDisabled: Bool = false
    
    public init(panelTitle: String, icon: icon, category: String?) {
        self.panelTitle = panelTitle
        self.icon = icon
    }
}
