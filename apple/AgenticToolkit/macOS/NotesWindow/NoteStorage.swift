import Foundation

/// Abstract storage interface for note persistence.
/// Clients provide a concrete implementation backed by their storage layer
/// (SQLite, Core Data, file system, etc.).
///
/// All methods are synchronous and may throw on I/O failure.
/// Thread safety is the implementor's responsibility.
public protocol NoteStorage {
    public func fetchAllNotes() throws -> [Note]
    public func insertNote(_ note: Note) throws
    public func updateNote(_ note: Note) throws
    public func deleteNote(id: UUID) throws
}
