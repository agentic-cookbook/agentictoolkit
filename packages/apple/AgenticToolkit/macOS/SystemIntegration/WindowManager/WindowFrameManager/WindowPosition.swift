import CoreGraphics

/// A proportional position within a screen's visible frame.
/// Values range from 0.0 (left/bottom edge) to 1.0 (right/top edge).
public enum WindowPosition: Equatable, Sendable, Codable {
    case center
    case topRight
    case custom(horizontal: CGFloat, vertical: CGFloat)

    public var proportionalX: CGFloat {
        switch self {
        case .center: return 0.5
        case .topRight: return 0.85
        case .custom(let horizontal, _): return horizontal
        }
    }

    public var proportionalY: CGFloat {
        switch self {
        case .center: return 0.5
        case .topRight: return 0.85
        case .custom(_, let vertical): return vertical
        }
    }
}
