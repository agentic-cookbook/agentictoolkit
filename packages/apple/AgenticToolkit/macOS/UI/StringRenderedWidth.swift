import AppKit

extension StringProtocol {

    /// The width in points this string occupies when rendered in `font`. Shared by
    /// settings controls that size themselves to their widest label (the topic-list
    /// sidebar, the choice slider) so there is one source of truth for text
    /// measurement.
    func renderedWidth(usingFont font: NSFont) -> CGFloat {
        (String(self) as NSString).size(withAttributes: [.font: font]).width
    }
}
