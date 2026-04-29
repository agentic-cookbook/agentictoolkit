import AppKit
import AgenticToolkitCore

extension ComposableSettings {

    /// A view model bound to a `ColorSetting`. Exposes the underlying color
    /// as an `NSColor` for convenient AppKit binding.
    public class ColorViewModel: ViewModel<RGBAColor> {

        public var color: NSColor {
            get { NSColor(settingObserver.value) }
            set { settingObserver.value = RGBAColor(newValue) }
        }
    }
}
