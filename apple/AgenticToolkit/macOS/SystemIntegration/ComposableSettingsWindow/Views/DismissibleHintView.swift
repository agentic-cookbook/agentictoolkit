import AppKit
import AgenticToolkitCore
import Combine

extension ComposableSettings {

    /// Coachmark-style hint with a "Got It" button. Hides itself once the
    /// backing `UserSetting<Bool>` flips to `true`. Use for one-time onboarding
    /// prompts ("enable launch at login so you never miss a session…").
    @MainActor
    public class DismissibleHintView: NSView, SettingsViewProtocol {
        public let textLabel: NSTextField
        public let dismissButton: NSButton

        private let observer: UserSettingObserver<Bool>
        

        public init(
            text: String,
            dismissedSetting: UserSetting<Bool>,
            buttonTitle: String = "Got It"
        ) {
            self.observer = UserSettingObserver(dismissedSetting)
            self.textLabel = NSTextField(wrappingLabelWithString: text)
            self.textLabel.font = .systemFont(ofSize: 12)
            self.textLabel.textColor = .secondaryLabelColor

            self.dismissButton = NSButton(title: buttonTitle, target: nil, action: nil)
            self.dismissButton.bezelStyle = .rounded
            self.dismissButton.controlSize = .small

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.dismissButton.target = self
            self.dismissButton.action = #selector(dismissTapped)

            let stack = NSStackView(views: [self.textLabel, self.dismissButton])
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = SettingsLayout.default[.rowSpacing]
            stack.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(stack)
            Self.pinToEdges(stack, of: self)

            self.observer.onChange = { [weak self] dismissed in
                self?.isHidden = dismissed
            }
            self.isHidden = self.observer.value
        }

        @objc private func dismissTapped() {
            self.observer.value = true
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }
    }
}
