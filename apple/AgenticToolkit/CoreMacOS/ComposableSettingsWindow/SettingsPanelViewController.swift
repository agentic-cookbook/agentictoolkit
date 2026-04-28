import AppKit
import Foundation
import Combine

extension ComposableSettings {
    
    /// Base class for every settings panel. One instance is hosted in the
    /// right-hand detail pane of a `SplitViewController`; the sidebar metadata
    /// lives on the panel itself via the open overrides below. The panel *is* the
    /// list item — no wrapper struct.
    @MainActor
    open class SettingsPanelViewController: NSViewController {
        
        /// This is what is user for the settings panel list
        public let descriptor: Descriptor
        
        public let settingsView = PanelView()
                
        public var settingsLayout: SettingsLayout = .default
        
        open override func loadView() {
            self.view = settingsView
        }
        
        public init(with descriptor: Descriptor? = nil) {
            if let descriptor {
                self.descriptor = descriptor
            } else {
                self.descriptor = Descriptor()
            }
            super.init(nibName: nil, bundle: nil)
        }
        
        public required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }
        
        public func addGroup(_ group: GroupView) {
            self.settingsView.addGroup(group)
        }
    }
}

extension ComposableSettings.SettingsPanelViewController {
    
    public class Descriptor: ObservableObject {
        
        @Published public var title: String
        @Published public var icon: NSImage?
        @Published public var isDisabled: Bool = false
        
        @Published public var section: String?
        
        public init(title: String, icon: NSImage? = nil, isDisabled: Bool = false, section: String? = nil) {
            self.title = title
            self.icon = icon
            self.isDisabled = isDisabled
        }
        
        public convenience init() {
            self.init(title: "")
        }
    }
}
