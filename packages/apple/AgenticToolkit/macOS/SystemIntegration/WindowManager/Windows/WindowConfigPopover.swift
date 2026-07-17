import AppKit

/// A window's gear-button config popover, shared so every window can reuse the
/// same chrome: a borderless gear `NSButton` that toggles a transient
/// `NSPopover` stacking a bold section title over caller-supplied settings
/// controls (typically `ComposableSettings` views bound to `UserSettings`, so
/// the popover and the Settings window drive one path).
///
/// The component owns the button, the popover, and the toggle wiring; it
/// deliberately does NOT own placement — each window puts `gearButton` where its
/// chrome wants it (a titlebar accessory for Usage Details, a header row for
/// Oversight/Sessions, an inline slot for the borderless Usage HUD).
///
/// While the popover is open it **freezes the host window's content refit**: if
/// the gear button lives in a `SingleWindowController` window, opening the
/// popover calls `suppressContentRefit()` and closing it calls
/// `resumeContentRefit()`. That stops a size/text slider *inside* the popover
/// from resizing the window out from under the pointer, and applies one fit on
/// close — no per-window bookkeeping required. Callers that also want to react
/// to open/close can still hook `onWillShow` / `onDidClose`.
@MainActor
public final class WindowConfigPopover: NSObject {

    /// Place this in the window's chrome; the component wires its action.
    /// Hosts theme it (`contentTintColor`) alongside their other chrome.
    public let gearButton = NSButton()

    /// Fires as the popover opens (before it's on screen), after the host
    /// window's refit has been suppressed.
    public var onWillShow: (() -> Void)?
    /// Fires after the popover closes — both the toggle-close and the transient
    /// click-away close — after the host window's refit has resumed.
    public var onDidClose: (() -> Void)?

    public var isShown: Bool { popover.isShown }

    private let title: String
    private let makeControls: @MainActor () -> [NSView]
    private let popover = NSPopover()
    /// Controls are built once, on first open (they self-bind to settings).
    private var contentBuilt = false

    public init(
        title: String,
        tooltip: String = "Window settings",
        makeControls: @escaping @MainActor () -> [NSView]
    ) {
        self.title = title
        self.makeControls = makeControls
        super.init()

        gearButton.translatesAutoresizingMaskIntoConstraints = false
        gearButton.bezelStyle = .accessoryBarAction
        gearButton.isBordered = false
        gearButton.image = NSImage(systemSymbolName: "gearshape", accessibilityDescription: tooltip)
        gearButton.imagePosition = .imageOnly
        gearButton.toolTip = tooltip
        gearButton.target = self
        gearButton.action = #selector(gearTapped)
        gearButton.contentTintColor = .secondaryLabelColor

        popover.behavior = .transient
        popover.delegate = self
    }

    /// Builds a right-side titlebar accessory `[leading…, ⚙]` — the Usage Details
    /// chrome, shared so every window's gear sits in the same place (trailing edge
    /// of the title bar, gear rightmost). Callers pass their window-specific leading
    /// chrome (e.g. an "Updated" label, a spinner, a refresh button); the gear is
    /// always appended last.
    ///
    /// The container gets an explicit frame because `NSTitlebarAccessoryViewController`
    /// lays out by frame, not Auto Layout — a pure-autolayout view reports zero width
    /// and vanishes.
    public func makeTitlebarAccessory(
        leading: [NSView] = [],
        width: CGFloat = 240
    ) -> NSTitlebarAccessoryViewController {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: width, height: 28))
        container.autoresizingMask = [.minXMargin]

        let row = NSStackView(views: leading + [gearButton])
        row.orientation = .horizontal
        row.spacing = 6
        row.alignment = .centerY
        row.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(row)
        NSLayoutConstraint.activate([
            row.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -10),
            row.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 8),
            row.centerYAnchor.constraint(equalTo: container.centerYAnchor)
        ])

        let controller = NSTitlebarAccessoryViewController()
        controller.view = container
        controller.layoutAttribute = .right
        return controller
    }

    @objc private func gearTapped() {
        toggle()
    }

    public func toggle() {
        if popover.isShown {
            popover.close()
        } else {
            if !contentBuilt {
                popover.contentViewController = ContentViewController(title: title, controls: makeControls())
                contentBuilt = true
            }
            popover.show(relativeTo: gearButton.bounds, of: gearButton, preferredEdge: .minY)
        }
    }

    /// The `SingleWindowController` hosting the gear button, if any — the popover
    /// suppresses/resumes its content refit around open/close so a slider inside
    /// the popover can't resize the window under the pointer.
    private var hostController: SingleWindowController? {
        gearButton.window?.windowController as? SingleWindowController
    }

    /// The popover body: bold caption title over the controls, fixed width so
    /// sliders and popups line up (the Usage Details popover's layout,
    /// generalized). Internal so tests can assert the assembly without
    /// presenting a popover.
    final class ContentViewController: NSViewController {
        private let popoverTitle: String
        private let controls: [NSView]
        static let popoverWidth: CGFloat = 320

        init(title: String, controls: [NSView]) {
            self.popoverTitle = title
            self.controls = controls
            super.init(nibName: nil, bundle: nil)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) { fatalError("ContentViewController is code-built, never decoded") }

        override func loadView() {
            let titleLabel = NSTextField(labelWithString: popoverTitle)
            titleLabel.font = NSFont.boldSystemFont(ofSize: NSFont.smallSystemFontSize)
            titleLabel.textColor = .secondaryLabelColor

            let stack = NSStackView(views: [titleLabel] + controls)
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = 12
            stack.edgeInsets = NSEdgeInsets(top: 14, left: 16, bottom: 14, right: 16)
            stack.translatesAutoresizingMaskIntoConstraints = false

            let root = NSView()
            root.addSubview(stack)
            var constraints = [
                stack.topAnchor.constraint(equalTo: root.topAnchor),
                stack.bottomAnchor.constraint(equalTo: root.bottomAnchor),
                stack.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                stack.trailingAnchor.constraint(equalTo: root.trailingAnchor),
                root.widthAnchor.constraint(equalToConstant: Self.popoverWidth)
            ]
            // Every control fills the popover width (minus the stack insets) so
            // sliders get room and rows align; leading-aligned content like
            // checkboxes is unaffected by the extra trailing space.
            for control in controls {
                constraints.append(control.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -32))
            }
            NSLayoutConstraint.activate(constraints)
            self.view = root
        }
    }
}

extension WindowConfigPopover: NSPopoverDelegate {
    public func popoverWillShow(_ notification: Notification) {
        hostController?.suppressContentRefit()
        onWillShow?()
    }

    public func popoverDidClose(_ notification: Notification) {
        hostController?.resumeContentRefit()
        onDidClose?()
    }
}
