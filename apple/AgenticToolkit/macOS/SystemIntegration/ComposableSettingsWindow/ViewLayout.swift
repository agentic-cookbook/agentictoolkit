import AppKit
import Combine

extension ComposableSettings {

    public enum LayoutKey: String, Sendable, Codable, Equatable {
        case panelInset
        case groupSpacing
        case rowSpacing
        case dividerThickness
    }
    
    @MainActor
    public final class SettingsLayout: Observable {
        
        public static let `default` = SettingsLayout([
            .panelInset: 24.0,
            .groupSpacing: 16.0,
            .rowSpacing: 8.0,
            .dividerThickness: 1.0
        ])

        @Published public private(set) var values: [LayoutKey: CGFloat]
        
        public init(_ values: [LayoutKey: CGFloat]) {
            self.values = values
        }
        
        subscript(_ index: LayoutKey) -> Double {
            guard let value = values[index] else {
                return 0.0
            }
            
            return value
        }
    }
}

extension NSView {

    @MainActor
    static func makeRow(
        _ views: [NSView]
    ) -> NSStackView {
        for view in views {
            view.translatesAutoresizingMaskIntoConstraints = false
        }
        let row = NSStackView(views: views)
        row.orientation = .horizontal
        row.spacing = ComposableSettings.SettingsLayout.default[.rowSpacing]
        row.alignment = .firstBaseline
        row.translatesAutoresizingMaskIntoConstraints = false
        return row
    }

    @MainActor
    static func pinToEdges(_ view: NSView, of container: NSView) {
        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: container.topAnchor),
            view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            view.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
    }
}
