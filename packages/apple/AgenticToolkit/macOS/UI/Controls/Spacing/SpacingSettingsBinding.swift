import AppKit

import AgenticToolkitCore

/// Ties a `SpacingControl` to the settings that hold its numbers.
///
/// The control itself knows nothing about storage — which is what lets the same
/// view serve terminal padding and pane spacing, whose values live in different
/// keys. This is the one place the two meet: it seeds the control, writes what
/// the user changes, and follows the settings back when something else moves
/// them (`separation-of-concerns`).
///
/// Only the settings whose value actually differs are written, so one click on
/// one arrow publishes one key rather than six — the difference between a live
/// preview that repaints once and one that repaints six times.
@MainActor
public final class SpacingSettingsBinding {

    /// Weak, and it has to be: the control owns this binding
    /// (`SpacingControl.retainedBinding`), so a strong reference back would be
    /// a cycle and neither object would ever be freed — taking the settings
    /// observers, and their live subscriptions, with them.
    private weak var control: SpacingControl?
    private let edges: [SpacingEdge: UserSetting<Int>]
    private let gutters: [SpacingGutter: UserSetting<Int>]

    /// The same range the control was built with. The binding needs it too:
    /// the control clamps what the *user* types, and settings written before
    /// the range narrowed have never been through it.
    private let range: ClosedRange<Int>
    private var observers: [UserSettingObserver<Int>] = []

    public init(
        control: SpacingControl,
        edges: [SpacingEdge: UserSetting<Int>],
        gutters: [SpacingGutter: UserSetting<Int>] = [:],
        range: ClosedRange<Int> = 0...40
    ) {
        self.control = control
        self.edges = edges
        self.gutters = gutters
        self.range = range

        control.value = currentValue()

        // A stored number the range no longer admits is migrated here, once, in
        // the open. It was 0...80 before the maximum came down to 40, so a
        // user who had set 60 has a setting the control cannot show. Left
        // alone, the control would display 40 while the panes went on being
        // laid out at 60, and the first arrow click would silently write the 40
        // anyway — the same destruction, at a moment that looks like an
        // unrelated edit. Writing it now means the picture and the panes agree
        // from the first frame.
        write(control.value)
        control.onChange = { [weak self] value in
            self?.write(value)
        }

        // No "am I the one writing?" flag guards these. The observers are
        // delivered on a later main-queue turn, by which point every key this
        // binding wrote has landed — so re-seeding assigns exactly the value
        // the control already holds, `value.didSet`'s inequality guard returns
        // early, and nothing is re-published. A flag cleared by a `defer` could
        // not have suppressed an async delivery anyway.
        for setting in edges.values.map({ $0 }) + gutters.values.map({ $0 }) {
            observers.append(UserSettingObserver(setting) { [weak self] _ in
                guard let self else { return }
                self.control?.value = self.currentValue()
            })
        }
    }

    private func currentValue() -> Spacing {
        var value = Spacing()
        for (edge, setting) in edges {
            value[edge] = clamped(setting.value)
        }
        for (gutter, setting) in gutters {
            value[gutter] = clamped(setting.value)
        }
        return value
    }

    private func clamped(_ number: Int) -> Int {
        min(max(number, range.lowerBound), range.upperBound)
    }

    private func write(_ value: Spacing) {
        for (edge, setting) in edges where setting.value != value[edge] {
            setting.value = value[edge]
        }
        for (gutter, setting) in gutters where setting.value != value[gutter] {
            setting.value = value[gutter]
        }
    }
}

extension SpacingControl {

    /// A control already wired to its settings, which is how every caller in
    /// this framework wants one. The control owns the binding, so a settings
    /// panel can build it in a single expression and forget about it.
    public static func boundToSettings(
        style: Style,
        edges: [SpacingEdge: UserSetting<Int>] = [:],
        gutters: [SpacingGutter: UserSetting<Int>] = [:],
        range: ClosedRange<Int> = 0...40
    ) -> SpacingControl {
        // Both dictionaries default to empty because each style uses one of
        // them, so neither can be required — which leaves nothing to stop a
        // caller passing the wrong one, or forgetting both, and getting a
        // control that draws its diagram and edits nothing. The style says
        // which one is the real argument, so it can say so out loud
        // (`fail-fast`): a settings panel whose numbers go nowhere is a bug
        // that reads as a working control.
        switch style {
        case .frame:
            precondition(!edges.isEmpty, "a .frame SpacingControl needs edge settings to edit")
        case .paneDividers:
            precondition(!gutters.isEmpty, "a .paneDividers SpacingControl needs gutter settings to edit")
        }

        let control = SpacingControl(style: style, range: range)
        control.retainedBinding = SpacingSettingsBinding(
            control: control,
            edges: edges,
            gutters: gutters,
            range: range
        )
        return control
    }
}
