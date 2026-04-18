import Foundation

/// One row in a ``LogView``.
///
/// The row carries values keyed by ``LogColumn/id``; cells for unknown
/// column ids render empty. `context` is an opaque payload the producer
/// can attach — typically a database id, session id, or similar handle
/// that click hooks on ``LogColumn`` need to act on the row.
@MainActor
public struct LogLine: Identifiable {
    public let id: UUID
    public let values: [String: LogCellValue]
    public let context: Any?

    public init(
        id: UUID = UUID(),
        values: [String: LogCellValue],
        context: Any? = nil
    ) {
        self.id = id
        self.values = values
        self.context = context
    }

    public subscript(columnID: String) -> LogCellValue? {
        values[columnID]
    }
}
