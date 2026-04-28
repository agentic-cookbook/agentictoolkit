import AppKit

/// Base view for settings panels. Hosts shared visual utilities such as
/// section headers. Subclasses can extend with panel-specific layout.
@MainActor
open class ComposableSettingsPanelView: NSStackView {
    private let stackView: NSStackView
    
    public init() {
        self.stackView = NSStackView()
        self.stackView.orientation = .vertical
        self.stackView.spacing = 16
        
        super.init(nibName: nil, bundle: nil)
    }
    
    public func add(_ view: SettingPanelComposableView) {
        
    }
}

@MainActor
public class SettingPanelGroupItem: NSView {
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

@MainActor
public class SettingPanelComposableView: NSView {
    
   
}

/// This is a small blurb describing a setting
@MainActor
public class SettingPanelExplanationView: NSView, SettingPanelComposableView {
    public let label: NSTextField
    
    public init(withText text: String) {
        self.label = Self.createLabel(title: text)
        super.init(frame: .zero)
        
        self.addSubview(self.label)
    }
}

@MainActor
public class SettingSettingsPanelHeaderView: NSView, SettingPanelComposableView {
    public let titleLabel: NSTextField
    
    public init(title: String) {
        self.titleLabel = Self.createLabel(title: title)
        super.init(frame: .zero)
        
        self.addSubview(self.titleLabel)
            
    }
}

@MainActor
public class SettingsPanelCheckboxView: SettingPanelComposableView {
    public let label: NSTextField
    public let checkbox: NSButton
    
    public init(withTitle title: String, isOn: Bool) {
        self.label = Self.createLabel(title: title)
        self.checkbox = NSButton(checkboxWithTitle: "", target: nil, action: nil)
        self.checkbox.makeBody(configuration: .init(isOn: isOn))
    }
}

@MainActor
public class SettingsPanelTextFieldView: SettingPanelComposableView {
    public let label: NSTextField
    public let textField: NSTextField
    
    public init(withTitle title: String, text: String) {
        self.label = Self.createLabel(title: title)
        self.textField = NSTextField(string: text)
    }
}

@MainActor
public class SettingsPanelSliderView: SettingPanelComposableView {
    public let label: NSTextField
    public let slider: NSSlider
    
    public init(withTitle title: String, value: Double, minValue: Double, maxValue: Double) {
        self.label = Self.createLabel(title: title)
        self.slider = NSSlider(value: value, in: minValue...maxValue)
    }
}

@MainActor
public class SettingsPanelButtonView: SettingPanelComposableView {
    public let label: NSTextField
    public let button: NSButton
    
    public init(withTitle title: String) {
        self.label = Self.createLabel(title: title)
        self.button = NSButton(title: title, target: nil, action: nil)
    }
}

@MainActor
public class SettingsPanelColorPickerView: SettingPanelComposableView {
    public let label: NSTextField
    public let colorWell: NSColorWell
    
    public init(withTitle title: String, color: NSColor) {
        self.label = Self.createLabel(title: title)
        self.colorWell = NSColorWell()
        self.colorWell.color = color
    }
}

@MainActor
public class SettingsPanelPopupMenuChoiceView: SettingPanelComposableView {
    public let label: NSTextField
    public let popUpButton: NSPopUpButton
    
    public init(withTitle title: String, choices: [String]) {
        self.label = Self.createLabel(title: title)
        self.popUpButton = NSPopUpButton(frame: .zero)
    }
}
    
@MainActor
public class SetttingsPanelRadioButtonChoiceView: SettingPanelComposableView {
    public let label: NSTextField
    public let radioButtons: [NSButton]
    
    public init(label: NSTextField, radioButtons: [NSButton]) {
        self.label = label
        self.radioButtons = radioButtons
    }
}

@MainActor
public class SettingsPanelDividerView: SettingPanelComposableView {
    
    /// TODO: this should be a single line
    
    public init() {
        self.init(view: NSView())
    }
}

@MainActor
public class SettingsPanelProgressView: SettingPanelComposableView {
    public let progressIndicator: NSProgressIndicator
    
    public init() {
        self.progressIndicator = NSProgressIndicator()
        self.progressIndicator.controlSize = .regular
        self.progressIndicator.isIndeterminate = true
        
        self.init(view: self.progressIndicator)
    }
}

@MainActor
public class SettingsPanelTextView: SettingPanelComposableView {
    public let textView: NSTextView
    
    public init(withText text: String) {
        self.textView = NSTextView()
        self.textView.string = text
        
        self.init(view: self.textView)
    }
}

@MainActor
public class SettingsPanelVerticalStackView: SettingPanelComposableView {
    public let stackView: NSStackView
    
    public init() {
        self.stackView = NSStackView()
        self.stackView.orientation = .vertical
        self.stackView.spacing = 16
        
        super.init(nibName: nil, bundle: nil)
    }
}

@MainActor
public class SettingsPanelHorizontalStackView: SettingPanelComposableView {
    public let stackView: NSStackView
    
    public init() {
        self.stackView = NSStackView()
        self.stackView.orientation = .horizontal
        self.stackView.spacing = 16
        
        super.init(nibName: nil, bundle: nil)
    }
}

