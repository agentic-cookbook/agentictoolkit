import AppKit

/// Column configuration for a ``LogView``.
///
/// A column is a value-type descriptor plus two optional click hooks
/// (`onClick`, `onDoubleClick`). The view wires table clicks through to
/// the hooks defined on the clicked column — domain logic (opening a
/// session detail, copying an id, etc.) lives with the consumer, not
/// the view.
@MainActor
public struct LogColumn {
    public let id: String
    public let title: String
    public let defaultWidth: CGFloat
    public let minWidth: CGFloat
    public let maxWidth: CGFloat
    public let alignment: NSTextAlignment
    /// Cosmetic hint — currently unused by ``LogView``, reserved so
    /// consumers can mark which columns should show a pointing-hand
    /// cursor or underlined text when rendering attributed values.
    public let isClickable: Bool
    public let onClick: ((LogLine) -> Void)?
    public let onDoubleClick: ((LogLine) -> Void)?

    public init(
        id: String,
        title: String,
        defaultWidth: CGFloat = 120,
        minWidth: CGFloat = 60,
        maxWidth: CGFloat = 10_000,
        alignment: NSTextAlignment = .natural,
        isClickable: Bool = false,
        onClick: ((LogLine) -> Void)? = nil,
        onDoubleClick: ((LogLine) -> Void)? = nil
    ) {
        self.id = id
        self.title = title
        self.defaultWidth = defaultWidth
        self.minWidth = minWidth
        self.maxWidth = maxWidth
        self.alignment = alignment
        self.isClickable = isClickable
        self.onClick = onClick
        self.onDoubleClick = onDoubleClick
    }
}
