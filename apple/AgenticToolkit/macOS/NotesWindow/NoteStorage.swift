import Foundation

/// Abstract storage interface for note persistence.
/// Clients provide a concrete implementation backed by their storage layer
/// (SQLite, Core Data, file system, etc.).
///
/// All methods are synchronous and may throw on I/O failure.
/// Thread safety is the implementor's responsibility.
public protocol NoteStorage {
    func fetchAllNotes() throws -> [Note]
    func insertNote(_ note: Note) throws
    func updateNote(_ note: Note) throws
    func deleteNote(id: UUID) throws
}
