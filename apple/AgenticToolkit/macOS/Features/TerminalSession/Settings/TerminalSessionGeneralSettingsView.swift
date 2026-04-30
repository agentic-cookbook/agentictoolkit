import AppKit

/// Terminal general settings: startup behavior, default shell, new session profile defaults.
public final class TerminalSessionGeneralSettingsView: NSView {

    private let startupPopUp = NSPopUpButton()
    private let shellField = NSTextField()
    private let profilePopUp = NSPopUpButton()
    private let followSystemNote = NSTextField(wrappingLabelWithString:
        "The terminal will use a dark profile when the system is in Dark Mode, and a light profile in Light Mode.")

    public override init(frame: NSRect) {
        super.init(frame: frame)
        setupViews()
        loadValues()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.edgeInsets = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)

        stack.addArrangedSubview(makeSection("Startup", content: makeStartupSection()))
        stack.addArrangedSubview(makeSection("Shell", content: makeShellSection()))
        stack.addArrangedSubview(makeSection("New Session Defaults", content: makeProfileSection()))

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor)
        ])
    }

    // MARK: - Section Builders

    private func makeStartupSection() -> NSView {
        startupPopUp.removeAllItems()
        for option in TerminalSessionStartupBehavior.allCases {
            startupPopUp.addItem(withTitle: option.label)
            startupPopUp.lastItem?.representedObject = option.rawValue
        }
        startupPopUp.target = self
        startupPopUp.action = #selector(startupChanged)

        return makeLabeledRow("On launch:", control: startupPopUp)
    }

    private func makeShellSection() -> NSView {
        shellField.placeholderString = "/bin/zsh"
        shellField.target = self
        shellField.action = #selector(shellChanged)
        shellField.translatesAutoresizingMaskIntoConstraints = false
        shellField.widthAnchor.constraint(greaterThanOrEqualToConstant: 200).isActive = true

        return makeLabeledRow("Default shell:", control: shellField)
    }

    private func makeProfileSection() -> NSView {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 6

        profilePopUp.removeAllItems()
        for option in TerminalSessionNewSessionDefault.allCases {
            profilePopUp.addItem(withTitle: option.label)
            profilePopUp.lastItem?.representedObject = option.rawValue
        }
        profilePopUp.target = self
        profilePopUp.action = #selector(profileDefaultChanged)

        stack.addArrangedSubview(makeLabeledRow("Profile:", control: profilePopUp))

        followSystemNote.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        followSystemNote.textColor = .secondaryLabelColor
        followSystemNote.isHidden = true
        followSystemNote.translatesAutoresizingMaskIntoConstraints = false
        followSystemNote.widthAnchor.constraint(lessThanOrEqualToConstant: 350).isActive = true
        stack.addArrangedSubview(followSystemNote)

        return stack
    }

    // MARK: - Layout Helpers

    private func makeSection(_ title: String, content: NSView) -> NSView {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 6

        let header = NSTextField(labelWithString: title)
        header.font = .boldSystemFont(ofSize: NSFont.systemFontSize)
        stack.addArrangedSubview(header)
        stack.addArrangedSubview(content)

        return stack
    }

    private func makeLabeledRow(_ label: String, control: NSView) -> NSView {
        let labelField = NSTextField(labelWithString: label)
        labelField.alignment = .right
        labelField.translatesAutoresizingMaskIntoConstraints = false
        labelField.widthAnchor.constraint(equalToConstant: 110).isActive = true

        let row = NSStackView(views: [labelField, control])
        row.orientation = .horizontal
        row.spacing = 8
        row.alignment = .firstBaseline
        return row
    }

    // MARK: - Values

    private func loadValues() {
        let startup = UserDefaults.standard.string(forKey: "terminal.startupBehavior")
            ?? TerminalSessionStartupBehavior.nothing.rawValue
        selectPopUpItem(startupPopUp, withValue: startup)

        let shell = UserDefaults.standard.string(forKey: "terminal.defaultShellPath")
            ?? ProcessInfo.processInfo.environment["SHELL"] ?? "/bin/zsh"
        shellField.stringValue = shell

        let profileDefault = UserDefaults.standard.string(forKey: "terminal.newSessionDefault")
            ?? TerminalSessionNewSessionDefault.defaultProfile.rawValue
        selectPopUpItem(profilePopUp, withValue: profileDefault)
        updateFollowSystemNote()
    }

    private func selectPopUpItem(_ popUp: NSPopUpButton, withValue value: String) {
        for (index, item) in popUp.itemArray.enumerated() {
            if item.representedObject as? String == value {
                popUp.selectItem(at: index)
                return
            }
        }
    }

    // MARK: - Actions

    @objc private func startupChanged() {
        if let value = startupPopUp.selectedItem?.representedObject as? String {
            UserDefaults.standard.set(value, forKey: "terminal.startupBehavior")
        }
    }

    @objc private func shellChanged() {
        UserDefaults.standard.set(shellField.stringValue, forKey: "terminal.defaultShellPath")
    }

    @objc private func profileDefaultChanged() {
        if let value = profilePopUp.selectedItem?.representedObject as? String {
            UserDefaults.standard.set(value, forKey: "terminal.newSessionDefault")
        }
        updateFollowSystemNote()
    }

    private func updateFollowSystemNote() {
        let value = profilePopUp.selectedItem?.representedObject as? String
        followSystemNote.isHidden = value != TerminalSessionNewSessionDefault.followSystem.rawValue
    }
}

// MARK: - Supporting Types

public enum TerminalSessionStartupBehavior: String, CaseIterable {
    case newWindow = "newWindow"
    case nothing = "nothing"

    public var label: String {
        switch self {
        case .newWindow: return "Open a new terminal window"
        case .nothing: return "Do nothing"
        }
    }
}

public enum TerminalSessionNewSessionDefault: String, CaseIterable {
    case defaultProfile = "default"
    case lastUsed = "lastUsed"
    case followSystem = "followSystem"

    public var label: String {
        switch self {
        case .defaultProfile: return "Default Profile"
        case .lastUsed: return "Last Used Profile"
        case .followSystem: return "Follow System Appearance"
        }
    }
}
