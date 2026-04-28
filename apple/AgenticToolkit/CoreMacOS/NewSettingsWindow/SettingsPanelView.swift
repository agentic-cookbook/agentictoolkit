import AppKit

/// Base view for settings panels. Hosts shared visual utilities such as
/// section headers. Subclasses can extend with panel-specific layout.
@MainActor
open class SettingsPanelView: NSView {

    
    
    public static func makeHeader(_ title: String) -> NSTextField {
        let label = NSTextField(labelWithString: title)
        label.font = .systemFont(ofSize: 13, weight: .semibold)
        return label
    }
}

extension SettingsPanelView {
    
    @MainActor
    public class Group: NSView {
        public let title: NSTextField
        public let body: NSView
        
        public init(withTitle title: String) {
            self.title = Self.createLabel(title: title)
            self.body = NSView()
            super.init(frame: .zero)
            
            self.addSubview(self.title)
            /// TODO: layout the title
            
            self.addSubview(self.body)
            /// TODO: layout the body with consistent padding etc
        }
        
        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }
        
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }
        
        private static func createLabel(title: String) -> NSTextField {
            let label = NSTextField(labelWithString: title)
            label.font = .systemFont(ofSize: 13, weight: .semibold)
            return label
        }
    
        public func addSection(_ section: Section) {
            self.addSubview(section)
            /// TODO layout sections
        }
    
    }
    
    
    public class CheckboxItem: NSView {
        
    }
    
}
