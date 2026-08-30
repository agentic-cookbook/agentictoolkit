import AppKit
import CoreText

extension NSFont {

    /// The same face with TABULAR figures: every digit the same advance, so a
    /// number that changes under the reader cannot change its own width.
    ///
    /// Text faces ship proportional figures by default — a `1` is narrower than
    /// a `0` — which is right for prose and wrong for anything that ticks. A
    /// live countdown redrawn every second re-measures a point or two wider or
    /// narrower on most ticks, and everything laid out beside it steps sideways
    /// each time; in a window that hugs its content, the window itself does.
    ///
    /// The face is kept. `NSFont.monospacedDigitSystemFont` is the system font
    /// or nothing, which cannot express "the theme's caption font, with steady
    /// digits" — this asks the descriptor for the feature instead, and returns
    /// `self` unchanged when the face has no tabular set to offer.
    public var tabularFigures: NSFont {
        let feature: [NSFontDescriptor.FeatureKey: Int] = [
            .typeIdentifier: kNumberSpacingType,
            .selectorIdentifier: kMonospacedNumbersSelector
        ]
        let descriptor = fontDescriptor.addingAttributes([.featureSettings: [feature]])
        return NSFont(descriptor: descriptor, size: pointSize) ?? self
    }
}
