import Foundation
import os

/// Coordinates in-memory note state and storage persistence.
/// All access must happen on the main actor.
@MainActor
public final class NotesManager {

    // MARK: - State

    public private(set) var notes: [Note] = []
    public private(set) var isLoaded: Bool = false

    // MARK: - Dependencies

    private let storage: NoteStorage
    private let logger: Logger?
    private var saveWorkItems: [UUID: DispatchWorkItem] = [:]

    // MARK: - Initialization

    public init(storage: NoteStorage, logger: Logger? = nil) {
        self.storage = storage
        self.logger = logger
    }

    // MARK: - Load

    public func loadNotes() async {
        do {
            let loaded = try storage.fetchAllNotes()
            notes = loaded.sorted(by: Note.defaultSort)
            isLoaded = true
            logger?.info("Loaded \(loaded.count) notes")
        } catch {
            isLoaded = true
            logger?.error("Failed to load notes: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - CRUD

    @discardableResult
    public func createNote(title: String, content: String) async -> UUID {
        let note = Note.new(title: title, content: content)
        notes.append(note)
        notes.sort(by: Note.defaultSort)
        do {
            try storage.insertNote(note)
        } catch {
            logger?.error("Failed to persist new note: \(error.localizedDescription, privacy: .public)")
        }
        return note.id
    }

    /// Updates title and content with a 1-second debounce to avoid excessive writes.
    public func updateNote(_ note: Note, title: String, content: String) async {
        guard let idx = notes.firstIndex(where: { $0.id == note.id }) else { return }
        var updated = notes[idx]
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.title = trimmed.isEmpty ? "Untitled Note" : trimmed
        updated.content = content
        updated.modifiedDate = Date()
        notes[idx] = updated
        notes.sort(by: Note.defaultSort)
        scheduleSave(updated)
    }

    public func togglePin(note: Note) async {
        guard let idx = notes.firstIndex(where: { $0.id == note.id }) else { return }
        var updated = notes[idx]
        updated.isPinned.toggle()
        updated.modifiedDate = Date()
        notes[idx] = updated
        notes.sort(by: Note.defaultSort)
        do {
            try storage.updateNote(updated)
        } catch {
            logger?.error("Failed to toggle pin: \(error.localizedDescription, privacy: .public)")
        }
    }

    public func deleteNote(id: UUID) async {
        notes.removeAll(where: { $0.id == id })
        do {
            try storage.deleteNote(id: id)
        } catch {
            logger?.error("Failed to delete note: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Debounced Save

    private func scheduleSave(_ note: Note) {
        saveWorkItems[note.id]?.cancel()
        let noteID = note.id
        let workItem = DispatchWorkItem { [weak self] in
            guard let self else { return }
            Task { @MainActor in
                self.saveWorkItems.removeValue(forKey: noteID)
                guard let current = self.notes.first(where: { $0.id == noteID }) else { return }
                do {
                    try self.storage.updateNote(current)
                } catch {
                    self.logger?.error("Auto-save failed: \(error.localizedDescription, privacy: .public)")
                }
            }
        }
        saveWorkItems[noteID] = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0, execute: workItem)
    }

    /// Immediately persists any pending debounced saves. Call before app termination.
    public func flushPendingSaves() {
        for (noteID, workItem) in saveWorkItems {
            workItem.cancel()
            if let note = notes.first(where: { $0.id == noteID }) {
                do {
                    try storage.updateNote(note)
                } catch {
                    logger?.error("Flush save failed: \(error.localizedDescription, privacy: .public)")
                }
            }
        }
        saveWorkItems.removeAll()
    }
}
