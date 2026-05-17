import AppKit

/// Internal container that pairs a `TabBarView` with a content area for a
/// single dock `Edge`. Owns layout only; `TabbedViewController` manages
/// tab state, selection, and child-view-controller mounting.
@MainActor
final class EdgePanel: NSView {

    let edge: Edge
    let tabBar: TabBarView
    let contentContainer = NSView()

    init(edge: Edge) {
        self.edge = edge
        self.tabBar = TabBarView(edge: edge)
        super.init(frame: .zero)
        setUp()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setUp() {
        translatesAutoresizingMaskIntoConstraints = false
        contentContainer.translatesAutoresizingMaskIntoConstraints = false

        addSubview(tabBar)
        addSubview(contentContainer)

        switch edge {
        case .top:
            NSLayoutConstraint.activate([
                tabBar.topAnchor.constraint(equalTo: topAnchor),
                tabBar.leadingAnchor.constraint(equalTo: leadingAnchor),
                tabBar.trailingAnchor.constraint(equalTo: trailingAnchor),

                contentContainer.topAnchor.constraint(equalTo: tabBar.bottomAnchor),
                contentContainer.leadingAnchor.constraint(equalTo: leadingAnchor),
                contentContainer.trailingAnchor.constraint(equalTo: trailingAnchor),
                contentContainer.bottomAnchor.constraint(equalTo: bottomAnchor)
            ])
        case .bottom:
            NSLayoutConstraint.activate([
                contentContainer.topAnchor.constraint(equalTo: topAnchor),
                contentContainer.leadingAnchor.constraint(equalTo: leadingAnchor),
                contentContainer.trailingAnchor.constraint(equalTo: trailingAnchor),
                contentContainer.bottomAnchor.constraint(equalTo: tabBar.topAnchor),

                tabBar.leadingAnchor.constraint(equalTo: leadingAnchor),
                tabBar.trailingAnchor.constraint(equalTo: trailingAnchor),
                tabBar.bottomAnchor.constraint(equalTo: bottomAnchor)
            ])
        case .left:
            NSLayoutConstraint.activate([
                tabBar.topAnchor.constraint(equalTo: topAnchor),
                tabBar.bottomAnchor.constraint(equalTo: bottomAnchor),
                tabBar.leadingAnchor.constraint(equalTo: leadingAnchor),

                contentContainer.topAnchor.constraint(equalTo: topAnchor),
                contentContainer.bottomAnchor.constraint(equalTo: bottomAnchor),
                contentContainer.leadingAnchor.constraint(equalTo: tabBar.trailingAnchor),
                contentContainer.trailingAnchor.constraint(equalTo: trailingAnchor)
            ])
        case .right:
            NSLayoutConstraint.activate([
                contentContainer.topAnchor.constraint(equalTo: topAnchor),
                contentContainer.bottomAnchor.constraint(equalTo: bottomAnchor),
                contentContainer.leadingAnchor.constraint(equalTo: leadingAnchor),
                contentContainer.trailingAnchor.constraint(equalTo: tabBar.leadingAnchor),

                tabBar.topAnchor.constraint(equalTo: topAnchor),
                tabBar.bottomAnchor.constraint(equalTo: bottomAnchor),
                tabBar.trailingAnchor.constraint(equalTo: trailingAnchor)
            ])
        }
    }
}
