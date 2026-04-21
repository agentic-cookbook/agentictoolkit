import SwiftUI

public enum GitFileStatus: String, Codable, CaseIterable, Sendable {
    case modified = "M"
    case added = "A"
    case deleted = "D"
    case renamed = "R"
    case untracked = "?"
    case conflicted = "U"
    case ignored = "!"

    public var color: Color {
        switch self {
        case .modified: return .orange
        case .added, .untracked: return .green
        case .deleted: return .red
        case .renamed: return .blue
        case .conflicted: return .purple
        case .ignored: return .gray
        }
    }

    public var displayCharacter: String { rawValue }

    public var priority: Int {
        switch self {
        case .conflicted: return 6
        case .modified: return 5
        case .added: return 4
        case .deleted: return 3
        case .renamed: return 2
        case .untracked: return 1
        case .ignored: return 0
        }
    }

    public static func merge(_ statuses: [GitFileStatus]) -> GitFileStatus? {
        statuses.max(by: { $0.priority < $1.priority })
    }
}
