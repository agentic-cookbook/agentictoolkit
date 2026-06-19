import AppKit
import AgenticToolkitPermissions

/// Drop-in settings panel: one `PermissionRowView` card per supplied
/// permission, with live status and a button that triggers the grant flow.
///
/// Refreshes when it appears and whenever the app reactivates (e.g. the user
/// returns from System Settings) — no polling timer. Free of any settings
/// framework, so any app or window can host it.
@MainActor
public final class PermissionsPanelView: NSView {

    private let permissions: [Permission]
    private let checker: any PermissionChecking
    private var rows: [PermissionRowView] = []
    private var isObserving = false

    public init(permissions: [Permission], checker: any PermissionChecking = SystemPermissionChecker()) {
        self.permissions = permissions
        self.checker = checker
        super.init(frame: .zero)
        buildLayout()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        // Selector-based observers are auto-zeroed on dealloc since macOS 10.11,
        // but remove explicitly so a view deallocated while still in a window
        // doesn't leave a dangling registration.
        NotificationCenter.default.removeObserver(self)
    }

    /// Re-reads the grant state of every row.
    public func refresh() async {
        for row in rows {
            await row.refresh()
        }
    }

    private func buildLayout() {
        translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 8
        stack.alignment = .leading
        stack.translatesAutoresizingMaskIntoConstraints = false

        for permission in permissions {
            let row = PermissionRowView(permission: permission, checker: checker) { [weak self] permission in
                self?.handleAction(permission)
            }
            rows.append(row)
            stack.addArrangedSubview(row)
            // A vertical NSStackView doesn't stretch arranged subviews across its
            // width (alignment governs cross-axis *positioning*, not fill), so each
            // row's width is pinned to the stack explicitly.
            row.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    private func handleAction(_ permission: Permission) {
        Task { @MainActor in
            await PermissionPresenter.present(permission, using: checker)
            await refresh()
        }
    }

    public override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window != nil {
            startObservingActivation()
            Task { @MainActor in await refresh() }
        }
    }

    private func startObservingActivation() {
        guard !isObserving else { return }
        isObserving = true
        // Refresh when *our* app becomes active (e.g. the user returns from
        // System Settings) — not on every app switch system-wide, which
        // `NSWorkspace.didActivateApplicationNotification` would do.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: NSApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    @objc private func appDidBecomeActive() {
        Task { @MainActor in await refresh() }
    }
}
