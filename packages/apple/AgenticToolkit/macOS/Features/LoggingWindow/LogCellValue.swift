import AppKit

/// Rendered value for a single cell in a ``LogLine``.
///
/// `.plain` is the default path — the view styles it with the column's
/// alignment and a system font. `.attributed` hands the view a fully
/// pre-styled string (useful for link-style session ids, event-type
/// colours, monospace timestamps, etc.) — the column's alignment still
/// applies, but font / colour are the caller's call.
public enum LogCellValue {
    case plain(String)
    case attributed(NSAttributedString)

    /// Plain-text representation — used for tooltips and accessibility.
    public var text: String {
        switch self {
        case .plain(let plain): return plain
        case .attributed(let attributed): return attributed.string
        }
    }
}
