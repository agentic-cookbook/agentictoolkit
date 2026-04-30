import Foundation

public struct Note: Identifiable, Equatable, Sendable {
    public let id: UUID
    public var title: String
    public var content: String
    public let createdDate: Date
    public var modifiedDate: Date
    public var isPinned: Bool

    public init(
        id: UUID,
        title: String,
        content: String,
        createdDate: Date,
        modifiedDate: Date,
        isPinned: Bool
    ) {
        self.id = id
        self.title = title
        self.content = content
        self.createdDate = createdDate
        self.modifiedDate = modifiedDate
        self.isPinned = isPinned
    }

    /// Sort comparator: pinned notes first, then by modifiedDate descending.
    public static let defaultSort: @Sendable (Note, Note) -> Bool = { lhs, rhs in
        if lhs.isPinned != rhs.isPinned { return lhs.isPinned }
        return lhs.modifiedDate > rhs.modifiedDate
    }

    /// Creates a new note with sane defaults. Treats empty/whitespace titles as "Untitled Note".
    public static func new(title: String, content: String) -> Note {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return Note(
            id: UUID(),
            title: trimmed.isEmpty ? "Untitled Note" : trimmed,
            content: content,
            createdDate: Date(),
            modifiedDate: Date(),
            isPinned: false
        )
    }
}
