import AppKit

/// AppKit view controller pairing a ``LogView`` with a toolbar that
/// surfaces the common controls a streaming log needs: pause, clear,
/// and a connection-status indicator. Hosts any ``LogController``, so
/// the source of rows (SSE, file tail, test fixture) is swappable.
///
/// Subclasses splice in domain-specific toolbar items via
/// ``leadingToolbarItems()`` / ``extraTrailingToolbarItems()`` and can
/// override the lifecycle hooks to do extra setup/teardown around
/// `start()` / `stop()`.
@MainActor
open class LogViewController: NSViewController {
    public let controller: any LogController
    public let logView: LogView

    private let pauseButton = NSButton()
    private let clearButton = NSButton()
    private let statusDot = NSView()
    private let statusLabel = NSTextField(labelWithString: "Connecting…")

    public init(controller: any LogController) {
        self.controller = controller
        self.logView = LogView(provider: controller.provider)
        super.init(nibName: nil, bundle: nil)
        controller.onStateChange = { [weak self] in self?.updateStateIndicators() }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) unavailable — use init(controller:)") }

    // MARK: - Subclass hooks

    /// Minimum content size enforced as constraints on the root view.
    /// `LogView` has no intrinsic width, so without a floor `NSWindow`
    /// collapses the controller's view to `fittingSize` after its
    /// async layout pass — a 1pt-wide window.
    open var minimumContentSize: NSSize { NSSize(width: 600, height: 400) }

    /// Height of the toolbar strip above the log view.
    open var toolbarHeight: CGFloat { 40 }

    /// Extra leading toolbar items placed to the left of the built-ins.
    /// Default empty. Subclasses override to add filter controls.
    open func leadingToolbarItems() -> [NSView] { [] }

    /// Extra trailing toolbar items inserted *before* the built-in
    /// pause/clear/status cluster. Default empty. Subclasses override
    /// to add commands like "Export…".
    open func extraTrailingToolbarItems() -> [NSView] { [] }

    // MARK: - View lifecycle

    open override func loadView() {
        let root = NSView(frame: NSRect(origin: .zero, size: defaultStartSize))
        root.autoresizingMask = [.width, .height]

        let toolbar = makeToolbar()
        let divider = NSBox()
        divider.boxType = .separator
        divider.translatesAutoresizingMaskIntoConstraints = false

        logView.translatesAutoresizingMaskIntoConstraints = false

        root.addSubview(toolbar)
        root.addSubview(divider)
        root.addSubview(logView)

        NSLayoutConstraint.activate([
            root.widthAnchor.constraint(greaterThanOrEqualToConstant: minimumContentSize.width),
            root.heightAnchor.constraint(greaterThanOrEqualToConstant: minimumContentSize.height),

            toolbar.topAnchor.constraint(equalTo: root.topAnchor),
            toolbar.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            toolbar.heightAnchor.constraint(equalToConstant: toolbarHeight),

            divider.topAnchor.constraint(equalTo: toolbar.bottomAnchor),
            divider.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            divider.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            divider.heightAnchor.constraint(equalToConstant: 1),

            logView.topAnchor.constraint(equalTo: divider.bottomAnchor),
            logView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            logView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            logView.bottomAnchor.constraint(equalTo: root.bottomAnchor)
        ])

        self.view = root
    }

    open override func viewDidLoad() {
        super.viewDidLoad()
        updateStateIndicators()
    }

    open override func viewDidAppear() {
        super.viewDidAppear()
        controller.start()
    }

    open override func viewWillDisappear() {
        super.viewWillDisappear()
        controller.stop()
    }

    // MARK: - Toolbar

    private var defaultStartSize: NSSize {
        NSSize(width: max(minimumContentSize.width, 900),
               height: max(minimumContentSize.height, 600))
    }

    private func makeToolbar() -> NSView {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false

        pauseButton.translatesAutoresizingMaskIntoConstraints = false
        pauseButton.bezelStyle = .texturedRounded
        pauseButton.title = "Pause"
        pauseButton.target = self
        pauseButton.action = #selector(pauseTapped)

        clearButton.translatesAutoresizingMaskIntoConstraints = false
        clearButton.bezelStyle = .texturedRounded
        clearButton.title = "Clear"
        clearButton.target = self
        clearButton.action = #selector(clearTapped)

        statusDot.translatesAutoresizingMaskIntoConstraints = false
        statusDot.wantsLayer = true
        statusDot.layer?.cornerRadius = 4

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.font = NSFont.systemFont(ofSize: NSFont.smallSystemFontSize)
        statusLabel.textColor = .secondaryLabelColor

        let leading = NSStackView(views: leadingToolbarItems())
        leading.translatesAutoresizingMaskIntoConstraints = false
        leading.orientation = .horizontal
        leading.spacing = 8
        leading.alignment = .centerY

        var trailingViews: [NSView] = extraTrailingToolbarItems()
        trailingViews.append(contentsOf: [pauseButton, clearButton, statusDot, statusLabel])
        let trailing = NSStackView(views: trailingViews)
        trailing.translatesAutoresizingMaskIntoConstraints = false
        trailing.orientation = .horizontal
        trailing.spacing = 8
        trailing.alignment = .centerY

        container.addSubview(leading)
        container.addSubview(trailing)

        NSLayoutConstraint.activate([
            leading.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),
            leading.centerYAnchor.constraint(equalTo: container.centerYAnchor),

            trailing.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -12),
            trailing.centerYAnchor.constraint(equalTo: container.centerYAnchor),

            statusDot.widthAnchor.constraint(equalToConstant: 8),
            statusDot.heightAnchor.constraint(equalToConstant: 8)
        ])
        return container
    }

    /// Refresh status dot + label + pause button title from the
    /// controller's state. Safe to call from `viewDidLoad`, the state
    /// callback, or any time the caller wants to force a redraw.
    public final func updateStateIndicators() {
        let (color, label): (NSColor, String)
        if controller.isConnected {
            color = .systemGreen
            label = "Connected"
        } else if let err = controller.lastError {
            color = .systemRed
            label = err
        } else {
            color = .systemOrange
            label = "Connecting…"
        }
        statusDot.layer?.backgroundColor = color.cgColor
        statusLabel.stringValue = label
        statusLabel.toolTip = label
        pauseButton.title = controller.isPaused ? "Resume" : "Pause"
    }

    // MARK: - Actions

    @objc private func pauseTapped() { controller.togglePause() }
    @objc private func clearTapped() { controller.clear() }
}
