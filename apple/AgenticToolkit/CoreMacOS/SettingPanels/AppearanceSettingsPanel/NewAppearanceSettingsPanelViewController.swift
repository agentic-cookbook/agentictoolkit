import AppKit

/// Reusable Settings panel offering a theme picker (`AppearanceMode`) and a
/// text-size scale (`TextSize`). Persists choices via `UserDefaults`, applies
/// the selected `NSApp.appearance` immediately, and notifies the host via
/// `onTextSizeChange` so it can re-render any dependent UI.
@MainActor
public final class NewAppearanceSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {
    
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        
        self.descriptor.title = "Appearance"
        self.descriptor.icon = NSImage(systemSymbolName: "paintbrush", accessibilityDescription: nil)
        
        self.settingsView.addGroup(createAppearanceGroup())
        self.settingsView.addGroup(createTextSizeGroup())
    }
    
    func createAppearanceGroup() -> ComposableSettings.GroupView {
        // port makeThemeRow row from AppearanceSettingsPanelViewController

        let groupView = ComposableSettings.GroupView(withTitle: "Appearance")
        
        
        
        
        return groupView
    }
    
    func createTextSizeGroup() -> ComposableSettings.GroupView {
        // port makeSizeStack row from AppearanceSettingsPanelViewController

        let groupView = ComposableSettings.GroupView(withTitle: "Text Size")

        
        return groupView
    }
}
