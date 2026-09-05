import SwiftUI

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    /// SwiftUI's half of the panel vocabulary: the caption, card, padded row and
    /// hairline that `GroupView` draws in AppKit, for the panels whose content is
    /// a SwiftUI view.
    ///
    /// They read the same `SettingsLayout.default` metrics as the AppKit views,
    /// so a panel written either way lands on the same grid (`dry`). That is the
    /// whole point of them existing: a SwiftUI panel that reaches for `List` and
    /// `Section` instead gets a striped table with a sticky grey header — which
    /// is a perfectly good table, and looks nothing like the rest of the window.
    ///
    /// Rows are composed rather than collected, so a card can hold a run of
    /// uniform rows, an action row and an empty state without the container
    /// having to know which is which:
    ///
    /// ```swift
    /// SettingsGroup("Skipped Folders") {
    ///     ForEach(Array(patterns.enumerated()), id: \.element) { index, pattern in
    ///         if index > 0 { SettingsCardDivider() }
    ///         SettingsCardRow { … }
    ///     }
    /// }
    /// ```
    public struct SettingsGroup<Content: View>: View {

        @Environment(\.theme) private var theme

        private let title: String?
        private let content: Content

        /// A group headed by `title`, or — with `title` nil — a bare card, for
        /// content whose subject the panel has already named.
        public init(_ title: String? = nil, @ViewBuilder content: () -> Content) {
            self.title = title
            self.content = content()
        }

        public var body: some View {
            VStack(alignment: .leading, spacing: SettingsLayout.default[.captionSpacing]) {
                if let title {
                    // Outside the card, not its first row: a title inside reads as
                    // just another setting. `HeaderView`'s roles, exactly.
                    Text(title)
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.secondaryText)
                }
                SettingsCard { content }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The rounded, raised box a group's rows sit in.
    ///
    /// Internal: `SettingsGroup` is the way to draw one. A card without the
    /// caption above it is half a group, and the two were published together
    /// only because they were written together.
    struct SettingsCard<Content: View>: View {

        @Environment(\.theme) private var theme

        private let content: Content

        init(@ViewBuilder content: () -> Content) {
            self.content = content()
        }

        var body: some View {
            VStack(spacing: 0) { content }
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(theme.elevatedSurface)
                .clipShape(
                    RoundedRectangle(
                        cornerRadius: SettingsLayout.default[.cardCornerRadius],
                        style: .continuous))
        }
    }

    /// One row's padding inside a card. The row keeps its own horizontal layout;
    /// this only supplies the inset that makes the card read as a container.
    public struct SettingsCardRow<Content: View>: View {

        private let content: Content

        public init(@ViewBuilder content: () -> Content) {
            self.content = content()
        }

        public var body: some View {
            content
                .padding(.horizontal, SettingsLayout.default[.cardHorizontalInset])
                .padding(.vertical, SettingsLayout.default[.cardVerticalInset])
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The hairline between two rows, inset from the leading edge so it starts
    /// under the labels — `GroupView`'s separator inset, in SwiftUI.
    public struct SettingsCardDivider: View {

        @Environment(\.theme) private var theme

        public init() {}

        public var body: some View {
            theme.divider
                .frame(height: SettingsLayout.default[.dividerThickness])
                .padding(.leading, SettingsLayout.default[.cardHorizontalInset])
        }
    }

    /// A search field for a panel that filters its own content.
    ///
    /// The system's search field, not a hand-drawn stand-in for one. An
    /// `HStack` of a magnifier glyph, a plain `TextField` and an "x" button
    /// looks like `NSSearchField` and behaves like none of it: no search-field
    /// role for VoiceOver, no Escape-to-clear, no recents menu, no focus ring,
    /// and a clear button that is not the system's. `ThemedSearchField` is the
    /// same control the sidebar's own search uses, so the two match by
    /// construction rather than by two sets of paddings agreeing (`dry`,
    /// `native-controls`).
    struct SettingsSearchField: NSViewRepresentable {

        private let placeholder: String
        @Binding private var text: String

        init(_ placeholder: String, text: Binding<String>) {
            self.placeholder = placeholder
            self._text = text
        }

        func makeNSView(context: Context) -> ThemedSearchField {
            let field = ThemedSearchField(placeholder: placeholder)
            // Filter as the reader types rather than on Return — the narrowing
            // *is* the feedback, exactly as in the sidebar's search.
            field.sendsWholeSearchString = false
            field.sendsSearchStringImmediately = true
            field.target = context.coordinator
            field.action = #selector(Coordinator.searchChanged(_:))
            return field
        }

        func updateNSView(_ field: ThemedSearchField, context: Context) {
            context.coordinator.text = _text
            // Only when it differs: assigning `stringValue` while the field is
            // being typed into moves the insertion point to the end.
            if field.stringValue != text { field.stringValue = text }
        }

        /// Its own height, the width it is offered. Without this the field is
        /// handed the whole height of whatever contains it.
        func sizeThatFits(
            _ proposal: ProposedViewSize, nsView: ThemedSearchField, context: Context
        ) -> CGSize? {
            let fitting = nsView.fittingSize
            return CGSize(width: proposal.width ?? fitting.width, height: fitting.height)
        }

        func makeCoordinator() -> Coordinator { Coordinator(text: _text) }

        @MainActor
        final class Coordinator: NSObject {

            /// Rebound on every update so the target of the field's action is
            /// always writing through the binding the current body handed us.
            var text: Binding<String>

            init(text: Binding<String>) { self.text = text }

            @objc func searchChanged(_ sender: NSSearchField) {
                text.wrappedValue = sender.stringValue
            }
        }
    }

}

extension View {

    /// A SwiftUI panel's own margin and the gap between its groups, from the same
    /// metrics `PanelView` lays its cards out with.
    public func settingsPanelInset() -> some View {
        padding(ComposableSettings.SettingsLayout.default[.panelInset])
    }
}
