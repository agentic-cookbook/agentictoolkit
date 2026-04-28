import AppKit

/// Base class for every settings panel. One instance is hosted in the
/// right-hand detail pane of a `SettingsSplitViewController`; the sidebar metadata
/// lives on the panel itself via the open overrides below. The panel *is* the
/// list item — no wrapper struct.
@MainActor
open class SettingsPanelViewController<PanelView: SettingsPanelView>: NSViewController {

    /// This is what is user for the settings panel list
    public let descriptor: any SettingsDescriptorProtocol

    open override func loadView() {
        self.view = SettingsPanelView()
    }
    
    public init(descriptor: any SettingsDescriptorProtocol) {
        self.descriptor = descriptor
        super.init(nibName: nil, bundle: nil)
    }
    
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

@MainActor
public protocol SettingsDescriptorProtocol {
    var panelTitle: String { get }
    var thumbnail: NSView { get }
    var category: String? { get }
}

public struct SettingsDescriptor: SettingsDescriptorProtocol {
    public let panelTitle: String
    public let thumbnail: NSView
    public let category: String? = nil
    
    public init(panelTitle: String, thumbnail: NSView, category: String?) {
        self.panelTitle = panelTitle
        self.thumbnail = thumbnail
    }
    
    public init(panelTitle: String, image: NSImage) {
        self.panelTitle = panelTitle
        self.thumbnail = NSImageView(image: image)
    }
}


