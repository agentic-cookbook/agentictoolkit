import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    /// A live sample of a theme, drawn as the app's own UI rather than as a row
    /// of color chips: window chrome and type, a sidebar with a selected row,
    /// form controls, status badges, the 16 ANSI swatches, and a terminal that
    /// honors the theme's terminal font, padding and cursor overrides.
    ///
    /// The point is to answer "what will this look like?" without switching to
    /// the theme first, so every sample is a real component's shape — a list row
    /// really is a rounded selection fill under `selectionText`, a badge really
    /// is `success`/`warning`/`danger`/`info`. Call `show(_:)` to update it.
    @MainActor
    public final class ThemePreviewView: NSView, SettingsViewProtocol {

        private let container = NSStackView()

        public init(theme: ColorTheme? = nil) {
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false
            self.wantsLayer = true

            self.container.orientation = .vertical
            self.container.alignment = .leading
            self.container.spacing = 10
            self.container.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.container)
            Self.pinToEdges(self.container, of: self)

            if let theme { self.show(theme) }
        }

        public required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        /// Renders the preview for `theme`.
        public func show(_ theme: ColorTheme) {
            let palette = SemanticPalette(theme: theme)
            // The preview's own backdrop is the window background, so panels read
            // against the real chrome color.
            self.layer?.backgroundColor = palette.nsColor(.windowBackground).cgColor
            self.container.arrangedSubviews.forEach { $0.removeFromSuperview() }

            // Full-width cards, in the order a reader scans: chrome and type
            // first, then the components built out of it, then the raw palette,
            // then the terminal (the one sample with settings of its own).
            let cards = [
                self.makeChromeSample(palette),
                self.makeListSample(palette),
                self.makeControlsSample(palette),
                self.makeStatusSample(palette),
                self.makeTerminalSample(theme, palette)
            ]
            for card in cards { self.container.addArrangedSubview(card) }
            self.container.addArrangedSubview(SwatchGridView(colors: palette.ansiColors, columns: 8))
            // The container is leading-aligned, so cards must be stretched
            // explicitly or they collapse to content width and stop reading as
            // app chrome.
            NSLayoutConstraint.activate(cards.map {
                $0.widthAnchor.constraint(equalTo: self.container.widthAnchor)
            })
        }

        // MARK: - App-chrome sample

        private func makeChromeSample(_ palette: SemanticPalette) -> NSView {
            let box = Self.roundedBox(fill: palette.nsColor(.surface))

            let title = Self.label("Window Title", color: palette.nsColor(.primaryText),
                                   font: palette.font(.title))
            let body = Self.label("Body text in the body font.", color: palette.nsColor(.primaryText),
                                  font: palette.font(.body))
            let caption = Self.label("Secondary caption text", color: palette.nsColor(.secondaryText),
                                     font: palette.font(.caption))

            let button = Self.pill("Button", fill: palette.color(.accent),
                                   textColor: palette.nsColor(.onAccentText), font: palette.font(.button))
            let selection = Self.pill("Selected", fill: palette.color(.selection),
                                      textColor: palette.nsColor(.selectionText), font: palette.font(.button))
            let controls = NSStackView(views: [button, selection])
            controls.orientation = .horizontal
            controls.spacing = 8

            let divider = Self.hairline(palette.nsColor(.divider))

            // Elevated, outlined sub-panel to showcase elevatedSurface + outline.
            let inner = Self.roundedBox(fill: palette.nsColor(.elevatedSurface))
            inner.layer?.borderWidth = 1
            inner.layer?.borderColor = palette.nsColor(.outline).cgColor
            let innerLabel = Self.label("Panel · outline", color: palette.nsColor(.tertiaryText),
                                        font: palette.font(.caption))
            inner.addSubview(innerLabel)
            NSLayoutConstraint.activate([
                innerLabel.topAnchor.constraint(equalTo: inner.topAnchor, constant: 6),
                innerLabel.bottomAnchor.constraint(equalTo: inner.bottomAnchor, constant: -6),
                innerLabel.leadingAnchor.constraint(equalTo: inner.leadingAnchor, constant: 10),
                innerLabel.trailingAnchor.constraint(equalTo: inner.trailingAnchor, constant: -10)
            ])

            let card = Self.fill(box, with: [title, body, caption, controls, divider, inner])
            NSLayoutConstraint.activate([
                divider.widthAnchor.constraint(equalTo: box.widthAnchor, constant: -24),
                inner.widthAnchor.constraint(equalTo: box.widthAnchor, constant: -24)
            ])
            return card
        }

        // MARK: - Sidebar / list sample

        /// A three-row list with a tab strip above it: the shape of every sidebar
        /// and document list in the app, and the one place `selection` /
        /// `selectionText` are seen doing their actual job.
        private func makeListSample(_ palette: SemanticPalette) -> NSView {
            let box = Self.roundedBox(fill: palette.nsColor(.surface))

            let tabs = NSStackView(views: [
                Self.pill("Notes", fill: palette.color(.elevatedSurface),
                          textColor: palette.nsColor(.primaryText), font: palette.font(.button)),
                Self.pill("Chat", fill: palette.color(.surface),
                          textColor: palette.nsColor(.secondaryText), font: palette.font(.button)),
                Self.pill("Terminal", fill: palette.color(.surface),
                          textColor: palette.nsColor(.secondaryText), font: palette.font(.button))
            ])
            tabs.orientation = .horizontal
            tabs.spacing = 4

            let rows = NSStackView(views: [
                self.listRow("Release notes", detail: "Yesterday", palette: palette, selected: false),
                self.listRow("Design review", detail: "2 days ago", palette: palette, selected: true),
                self.listRow("Scratch", detail: "Last week", palette: palette, selected: false)
            ])
            rows.orientation = .vertical
            rows.alignment = .leading
            rows.spacing = 2
            rows.translatesAutoresizingMaskIntoConstraints = false

            let filled = Self.fill(box, with: [tabs, rows])
            NSLayoutConstraint.activate([
                rows.widthAnchor.constraint(equalTo: box.widthAnchor, constant: -24)
            ])
            for row in rows.arrangedSubviews {
                row.widthAnchor.constraint(equalTo: rows.widthAnchor).isActive = true
            }
            return filled
        }

        /// One list row: title on the left, timestamp on the right, filled with
        /// `selection` when selected so the on-selection text color is exercised.
        private func listRow(
            _ title: String, detail: String, palette: SemanticPalette, selected: Bool
        ) -> NSView {
            let row = NSView()
            row.wantsLayer = true
            row.layer?.cornerRadius = 5
            row.layer?.backgroundColor = selected
                ? palette.nsColor(.selection).cgColor
                : NSColor.clear.cgColor
            row.translatesAutoresizingMaskIntoConstraints = false

            let primary = selected ? palette.nsColor(.selectionText) : palette.nsColor(.primaryText)
            let secondary = selected ? palette.nsColor(.selectionText) : palette.nsColor(.tertiaryText)
            let name = Self.label(title, color: primary, font: palette.font(.body))
            let when = Self.label(detail, color: secondary, font: palette.font(.caption))

            row.addSubview(name)
            row.addSubview(when)
            NSLayoutConstraint.activate([
                name.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 8),
                name.centerYAnchor.constraint(equalTo: row.centerYAnchor),
                when.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -8),
                when.centerYAnchor.constraint(equalTo: row.centerYAnchor),
                when.leadingAnchor.constraint(greaterThanOrEqualTo: name.trailingAnchor, constant: 8),
                row.topAnchor.constraint(equalTo: name.topAnchor, constant: -5),
                row.bottomAnchor.constraint(equalTo: name.bottomAnchor, constant: 5)
            ])
            return row
        }

        // MARK: - Controls sample

        /// A text field, a placeholder field and a checkbox — the three controls
        /// that read from `controlBackground`, `placeholderText` and `border`,
        /// none of which appear anywhere else in the preview.
        private func makeControlsSample(_ palette: SemanticPalette) -> NSView {
            let box = Self.roundedBox(fill: palette.nsColor(.surface))

            let filled = self.textFieldSample(
                "Typed text", color: palette.nsColor(.primaryText), palette: palette)
            let empty = self.textFieldSample(
                "Placeholder", color: palette.nsColor(.placeholderText), palette: palette)

            let check = Self.label("☑︎ Enabled    ☐ Disabled",
                                   color: palette.nsColor(.secondaryText), font: palette.font(.body))

            let fields = NSStackView(views: [filled, empty])
            fields.orientation = .horizontal
            fields.spacing = 8
            fields.distribution = .fillEqually
            fields.translatesAutoresizingMaskIntoConstraints = false

            let result = Self.fill(box, with: [fields, check])
            fields.widthAnchor.constraint(equalTo: box.widthAnchor, constant: -24).isActive = true
            return result
        }

        private func textFieldSample(
            _ text: String, color: NSColor, palette: SemanticPalette
        ) -> NSView {
            let field = Self.roundedBox(fill: palette.nsColor(.controlBackground))
            field.layer?.cornerRadius = 5
            field.layer?.borderWidth = 1
            field.layer?.borderColor = palette.nsColor(.border).cgColor

            let label = Self.label(text, color: color, font: palette.font(.body))
            field.addSubview(label)
            NSLayoutConstraint.activate([
                label.topAnchor.constraint(equalTo: field.topAnchor, constant: 4),
                label.bottomAnchor.constraint(equalTo: field.bottomAnchor, constant: -4),
                label.leadingAnchor.constraint(equalTo: field.leadingAnchor, constant: 7),
                label.trailingAnchor.constraint(lessThanOrEqualTo: field.trailingAnchor, constant: -7)
            ])
            return field
        }

        // MARK: - Status sample

        /// The four status roles side by side. They are derived from ANSI
        /// green/yellow/red/cyan by default, so a theme with a muddy palette
        /// shows it here first.
        private func makeStatusSample(_ palette: SemanticPalette) -> NSView {
            let box = Self.roundedBox(fill: palette.nsColor(.surface))
            let badges = NSStackView(views: [
                Self.badge("Success", palette.color(.success), palette),
                Self.badge("Warning", palette.color(.warning), palette),
                Self.badge("Error", palette.color(.danger), palette),
                Self.badge("Info", palette.color(.info), palette)
            ])
            badges.orientation = .horizontal
            badges.spacing = 6
            return Self.fill(box, with: [badges])
        }

        /// A tinted capsule: the status color at low alpha behind the status
        /// color as text, which is how the app draws badges everywhere else.
        private static func badge(
            _ text: String, _ color: RGBAColor, _ palette: SemanticPalette
        ) -> NSView {
            let badge = NSView()
            badge.wantsLayer = true
            badge.layer?.cornerRadius = 5
            badge.layer?.backgroundColor = NSColor(color).withAlphaComponent(0.22).cgColor
            badge.layer?.borderWidth = 1
            badge.layer?.borderColor = NSColor(color).withAlphaComponent(0.55).cgColor
            badge.translatesAutoresizingMaskIntoConstraints = false

            let label = self.label(text, color: NSColor(color), font: palette.font(.caption))
            badge.addSubview(label)
            NSLayoutConstraint.activate([
                label.topAnchor.constraint(equalTo: badge.topAnchor, constant: 2),
                label.bottomAnchor.constraint(equalTo: badge.bottomAnchor, constant: -2),
                label.leadingAnchor.constraint(equalTo: badge.leadingAnchor, constant: 7),
                label.trailingAnchor.constraint(equalTo: badge.trailingAnchor, constant: -7)
            ])
            return badge
        }

        // MARK: - Terminal sample

        /// The terminal sample honors the theme's *terminal* overrides — font,
        /// padding and cursor shape — resolved exactly the way a real session
        /// resolves them, so the Terminal topic's edits are visible here rather
        /// than only after opening a pane.
        private func makeTerminalSample(_ theme: ColorTheme, _ palette: SemanticPalette) -> NSView {
            let box = Self.roundedBox(fill: palette.nsColor(.windowBackground))
            box.layer?.borderWidth = 1
            box.layer?.borderColor = palette.nsColor(.border).cgColor
            let mono = TerminalAppearance.resolvedFont(theme: theme)
            let padding = TerminalAppearance.resolvedPadding(theme: theme)
            let cursor = TerminalAppearance.resolvedCursor(theme: theme)

            let prompt = Self.label("user@mac ~ % ls", color: palette.nsColor(.primaryText), font: mono)
            let caret = Self.caret(shape: cursor.shape, color: palette.nsColor(.cursor), font: mono)
            let promptRow = NSStackView(views: [prompt, caret])
            promptRow.orientation = .horizontal
            promptRow.spacing = 2
            promptRow.alignment = .centerY

            let dir = Self.label("Documents", color: palette.nsColor(.accent), font: mono)
            let file = Self.label("README.md", color: palette.nsColor(.secondaryText), font: mono)
            let row = NSStackView(views: [dir, file])
            row.orientation = .horizontal
            row.spacing = 10

            let stack = NSStackView(views: [promptRow, row])
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = 2
            stack.translatesAutoresizingMaskIntoConstraints = false
            box.addSubview(stack)
            // The sample's insets *are* the theme's terminal padding, so changing
            // padding visibly moves the text off the edge here too.
            NSLayoutConstraint.activate([
                stack.topAnchor.constraint(equalTo: box.topAnchor, constant: padding.top),
                stack.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: padding.leading),
                stack.trailingAnchor.constraint(lessThanOrEqualTo: box.trailingAnchor,
                                                constant: -padding.trailing),
                stack.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -padding.bottom),
                box.widthAnchor.constraint(greaterThanOrEqualToConstant: 280)
            ])
            return box
        }

        /// A one-cell caret in the chosen shape, sized off the terminal font so
        /// it stays proportional when the font size changes.
        private static func caret(
            shape: TerminalCursorShape, color: NSColor, font: NSFont
        ) -> NSView {
            let cell = NSSize(width: max(font.pointSize * 0.6, 5), height: font.pointSize + 3)
            let caret = NSView()
            caret.wantsLayer = true
            caret.translatesAutoresizingMaskIntoConstraints = false

            var size = cell
            switch shape {
            case .block:
                caret.layer?.backgroundColor = color.cgColor
            case .hollowBlock:
                caret.layer?.borderWidth = 1
                caret.layer?.borderColor = color.cgColor
            case .underline:
                caret.layer?.backgroundColor = color.cgColor
                size.height = 2
            case .bar:
                caret.layer?.backgroundColor = color.cgColor
                size.width = 2
            }
            NSLayoutConstraint.activate([
                caret.widthAnchor.constraint(equalToConstant: size.width),
                caret.heightAnchor.constraint(equalToConstant: size.height)
            ])
            return caret
        }

        // MARK: - Building blocks

        /// Stacks `views` vertically inside `box` at the card's standard insets.
        /// Every sample card has this same shape, so it is written once (`dry`).
        private static func fill(_ box: NSView, with views: [NSView]) -> NSView {
            let stack = NSStackView(views: views)
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = 6
            stack.translatesAutoresizingMaskIntoConstraints = false
            box.addSubview(stack)
            NSLayoutConstraint.activate([
                stack.topAnchor.constraint(equalTo: box.topAnchor, constant: 10),
                stack.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 12),
                // `lessThanOrEqualTo` so the box width is free to fill the preview
                // (set by the caller) rather than being driven to content width.
                stack.trailingAnchor.constraint(lessThanOrEqualTo: box.trailingAnchor, constant: -12),
                stack.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -10),
                box.widthAnchor.constraint(greaterThanOrEqualToConstant: 280)
            ])
            return box
        }

        private static func roundedBox(fill: NSColor) -> NSView {
            let box = NSView()
            box.wantsLayer = true
            box.layer?.cornerRadius = 8
            box.layer?.backgroundColor = fill.cgColor
            box.translatesAutoresizingMaskIntoConstraints = false
            return box
        }

        private static func hairline(_ color: NSColor) -> NSView {
            let line = NSView()
            line.wantsLayer = true
            line.layer?.backgroundColor = color.cgColor
            line.translatesAutoresizingMaskIntoConstraints = false
            line.heightAnchor.constraint(equalToConstant: 1).isActive = true
            return line
        }

        private static func label(_ text: String, color: NSColor, font: NSFont) -> NSTextField {
            let label = NSTextField(labelWithString: text)
            label.textColor = color
            label.font = font
            label.translatesAutoresizingMaskIntoConstraints = false
            return label
        }

        private static func pill(
            _ text: String, fill: RGBAColor, textColor: NSColor, font: NSFont
        ) -> NSView {
            let pill = NSView()
            pill.wantsLayer = true
            pill.layer?.cornerRadius = 5
            pill.layer?.backgroundColor = NSColor(fill).cgColor
            pill.translatesAutoresizingMaskIntoConstraints = false

            let label = self.label(text, color: textColor, font: font)
            pill.addSubview(label)
            NSLayoutConstraint.activate([
                label.topAnchor.constraint(equalTo: pill.topAnchor, constant: 3),
                label.bottomAnchor.constraint(equalTo: pill.bottomAnchor, constant: -3),
                label.leadingAnchor.constraint(equalTo: pill.leadingAnchor, constant: 10),
                label.trailingAnchor.constraint(equalTo: pill.trailingAnchor, constant: -10)
            ])
            return pill
        }
    }
}
