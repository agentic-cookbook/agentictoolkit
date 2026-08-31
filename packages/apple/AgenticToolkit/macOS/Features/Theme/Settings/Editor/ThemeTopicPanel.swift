import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Common ground for the five topics of the theme editor: the shared
/// `ThemeEditorContext`, the color-well plumbing two of them need, and the
/// small labelled-control builders they all use.
///
/// A base class rather than five copies because the color wells in particular
/// are a registry — a well has to be findable again from the `NSColorWell` the
/// action hands back — and that registry is the same in every topic that has
/// wells (`dry`).
@MainActor
class ThemeTopicPanel: ComposableSettings.SettingsPanelViewController {

    /// Which part of the theme a color well writes to.
    enum Slot: Equatable {
        case foreground, background, cursor, selection
        case ansi(Int)
        case role(ThemeRole)
        case paneOutline
    }

    let context: ThemeEditorContext

    private var colorWells: [(slot: Slot, well: NSColorWell)] = []

    init(context: ThemeEditorContext, title: String, symbol: String) {
        self.context = context
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: title,
            icon: NSImage(systemSymbolName: symbol, accessibilityDescription: title)
        ))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // MARK: - Color wells

    /// A color well over a small caption, sized so a row of them lines up.
    func wellColumn(_ caption: String, _ slot: Slot, _ rgba: RGBAColor) -> NSView {
        let well = makeWell(slot, rgba, size: NSSize(width: 40, height: 24))

        let label = NSTextField(labelWithString: caption)
        label.font = .systemFont(ofSize: 10)
        label.textColor = ThemePaletteObserver.currentPalette.secondaryTextColor
        label.alignment = .center

        let column = NSStackView(views: [well, label])
        column.orientation = .vertical
        column.spacing = 3
        column.alignment = .centerX
        column.translatesAutoresizingMaskIntoConstraints = false
        column.widthAnchor.constraint(equalToConstant: 72).isActive = true
        return column
    }

    /// A bare ANSI well — captioned by its position in the grid, not by a label.
    func ansiWell(_ index: Int, _ rgba: RGBAColor) -> NSView {
        let well = makeWell(.ansi(index), rgba, size: NSSize(width: 26, height: 22))
        well.toolTip = "ANSI \(index)"
        return well
    }

    private func makeWell(_ slot: Slot, _ rgba: RGBAColor, size: NSSize) -> NSColorWell {
        let well = NSColorWell()
        well.color = NSColor(rgba)
        well.target = self
        well.action = #selector(colorWellChanged(_:))
        well.isEnabled = context.isEditable
        well.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            well.widthAnchor.constraint(equalToConstant: size.width),
            well.heightAnchor.constraint(equalToConstant: size.height)
        ])
        colorWells.append((slot, well))
        return well
    }

    @objc private func colorWellChanged(_ sender: NSColorWell) {
        guard let entry = colorWells.first(where: { $0.well === sender }) else { return }
        let srgb = sender.color.usingColorSpace(.sRGB) ?? sender.color
        apply(RGBAColor(srgb), to: entry.slot)
    }

    private func apply(_ rgba: RGBAColor, to slot: Slot) {
        context.update { theme in
            switch slot {
            case .foreground: theme.foreground = rgba
            case .background: theme.background = rgba
            case .cursor: theme.cursor = rgba
            case .selection: theme.selection = rgba
            case .ansi(let index) where theme.ansi.indices.contains(index): theme.ansi[index] = rgba
            case .ansi: break
            case .role(let role): theme.roleOverrides[role.rawValue] = rgba
            case .paneOutline:
                theme.project = (theme.project ?? ThemeProjectOptions()).with { $0.paneOutline = rgba }
            }
        }
        didApplyColor(to: slot)
    }

    /// Hook for a topic that has to restyle something of its own after a color
    /// edit lands. Empty by default — most topics have nothing to do.
    func didApplyColor(to slot: Slot) {}

    // MARK: - Small builders

    func sectionTitle(_ text: String) -> NSTextField {
        let label = NSTextField(labelWithString: text)
        label.font = .systemFont(ofSize: 11, weight: .semibold)
        label.textColor = ThemePaletteObserver.currentPalette.secondaryTextColor
        return label
    }

    func rightLabel(_ text: String, width: CGFloat? = nil) -> NSTextField {
        let label = NSTextField(labelWithString: text)
        label.alignment = .right
        if let width {
            label.translatesAutoresizingMaskIntoConstraints = false
            label.widthAnchor.constraint(equalToConstant: width).isActive = true
        }
        return label
    }

    func captionLabel(_ text: String, _ width: CGFloat) -> NSTextField {
        let label = NSTextField(labelWithString: text)
        label.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        label.textColor = ThemePaletteObserver.currentPalette.secondaryTextColor
        label.translatesAutoresizingMaskIntoConstraints = false
        label.widthAnchor.constraint(equalToConstant: width).isActive = true
        return label
    }

    /// A vertical stack, leading-aligned — the shape almost every topic wants.
    func column(_ views: [NSView], spacing: CGFloat = 10) -> NSStackView {
        let stack = NSStackView(views: views)
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = spacing
        return stack
    }

    func row(_ views: [NSView], spacing: CGFloat = 8) -> NSStackView {
        let stack = NSStackView(views: views)
        stack.orientation = .horizontal
        stack.spacing = spacing
        return stack
    }
}

extension ThemeProjectOptions {
    /// In-place edit of an optional-fielded override struct without spelling out
    /// a temporary at every call site.
    func with(_ transform: (inout ThemeProjectOptions) -> Void) -> ThemeProjectOptions {
        var copy = self
        transform(&copy)
        return copy
    }
}

extension ThemeTerminalOptions {
    func with(_ transform: (inout ThemeTerminalOptions) -> Void) -> ThemeTerminalOptions {
        var copy = self
        transform(&copy)
        return copy
    }
}
