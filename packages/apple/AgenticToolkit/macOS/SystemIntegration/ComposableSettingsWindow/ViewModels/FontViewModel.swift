import AppKit
import AgenticToolkitCore

extension ComposableSettings {

    /// A font choice: a PostScript name and a size, stored as two settings.
    ///
    /// A PostScript name rather than a family because the point of a real font
    /// picker is telling `FiraCodeNF-Regular` from `FiraCodeNFP-Regular` — a
    /// family name cannot, and a popup of families is exactly what this
    /// replaces.
    @MainActor
    public final class FontViewModel: AbstractViewModel {

        public let nameObserver: UserSettingObserver<String>
        public let sizeObserver: UserSettingObserver<Double>

        /// Called after either half changes, from whichever end changed it.
        public var onChange: ((NSFont) -> Void)?

        public init(
            title: String,
            nameSetting: UserSetting<String>,
            sizeSetting: UserSetting<Double>,
            explanation: String? = nil
        ) {
            self.nameObserver = UserSettingObserver(nameSetting)
            self.sizeObserver = UserSettingObserver(sizeSetting)
            super.init(title: title, explanation: explanation)

            self.nameObserver.onChange = { [weak self] _ in
                guard let self else { return }
                self.onChange?(self.font)
            }
            self.sizeObserver.onChange = { [weak self] _ in
                guard let self else { return }
                self.onChange?(self.font)
            }
        }

        /// The stored choice, or a monospaced system font at the stored size if
        /// that font is not installed on this machine. Falling back rather than
        /// rewriting the setting keeps the user's choice intact on the machine
        /// that does have it.
        public var font: NSFont {
            let size = CGFloat(sizeObserver.value)
            return NSFont(name: nameObserver.value, size: size)
                ?? .monospacedSystemFont(ofSize: size, weight: .regular)
        }

        public var isInstalled: Bool {
            NSFont(name: nameObserver.value, size: CGFloat(sizeObserver.value)) != nil
        }

        public func setFont(_ font: NSFont) {
            if nameObserver.value != font.fontName {
                nameObserver.value = font.fontName
            }
            if sizeObserver.value != Double(font.pointSize) {
                sizeObserver.value = Double(font.pointSize)
            }
        }
    }
}
