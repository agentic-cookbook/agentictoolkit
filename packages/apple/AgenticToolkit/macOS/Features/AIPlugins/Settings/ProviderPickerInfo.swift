import AppKit
import AIPluginKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Typesets the provider picker's two preview panes — the provider description
/// under the providers table, and the model description under the models table.
///
/// Split out of ``ProviderPickerViewController`` because it is pure formatting:
/// palette + data in, `NSAttributedString` out, no view state. Both panes share
/// one visual grammar so the two halves of the window read as one dialog:
///
/// - an **eyebrow** (small, tracked, tertiary) naming the thing's category,
/// - a **title** in the pane's largest type,
/// - **prose** at 12pt in secondary, generously leaded,
/// - **section headings** in the eyebrow style, and
/// - **label / value rows** on a shared tab stop, so every value starts at the
///   same x and a wrapped value hangs under itself rather than under its label.
@MainActor
public enum ProviderPickerInfo {

    // MARK: - Panes

    /// The pane under the providers table: who this provider is, what it serves,
    /// and what connecting to it takes.
    public static func provider(_ row: ProviderPickerRow, palette: SemanticPalette) -> NSAttributedString {
        let out = NSMutableAttributedString()
        let template = row.available.template

        let category = row.llm.isEmpty ? row.provider : "\(row.provider) · \(row.llm)"
        out.append(eyebrow(category, palette))
        out.append(title(template.displayName, palette))

        for blurb in [template.providerDescription, template.llmDescription] {
            if let blurb, !blurb.isEmpty { out.append(prose(blurb, palette)) }
        }

        out.append(heading("Connection", palette))
        out.append(labelRow("Provider", row.provider, palette))
        if !row.llm.isEmpty { out.append(labelRow("LLM", row.llm, palette)) }
        out.append(labelRow("Config Type", row.configType, palette))
        if let url = template.defaultValues["baseURL"], !url.isEmpty {
            out.append(linkRow("Base URL", url, palette))
        }
        if !template.resolvedDefaultModel.isEmpty {
            out.append(labelRow("Default model", template.resolvedDefaultModel, palette))
        }
        out.append(labelRow("API key", template.secretRequired ? "Required" : "Not required", palette))
        return out
    }

    /// The pane under the models table: what this model is, what it can do, and
    /// the numbers this provider serves it under.
    ///
    /// The capability chips repeat what the table's check-mark columns already
    /// say, deliberately: the columns are for comparing models down a list, the
    /// chips for reading one model without having to look back up at a header.
    public static func model(
        name: String, info: AIModelCatalog.ResolvedModel, palette: SemanticPalette
    ) -> NSAttributedString {
        let out = NSMutableAttributedString()
        out.append(eyebrow("Model", palette))
        out.append(title(name, palette))

        let capabilities = ModelCapability.capabilities(of: info)
        if !capabilities.isEmpty { out.append(chipRow(capabilities.map(\.title), palette)) }

        if let text = info.description, !text.isEmpty { out.append(prose(text, palette)) }

        var specs: [(String, String)] = []
        if let context = info.contextWindow, context > 0 {
            specs.append(("Context", ModelChooserContent.tokenCount(context)))
        }
        if let output = info.maxOutput, output > 0 {
            specs.append(("Max output", ModelChooserContent.tokenCount(output)))
        }
        if let price = ModelChooserContent.priceLine(input: info.inputCostPerM, output: info.outputCostPerM) {
            specs.append(("Price", price))
        }
        if let goodFor = info.goodFor, !goodFor.isEmpty { specs.append(("Good for", goodFor)) }

        if !specs.isEmpty {
            out.append(heading("Specs", palette))
            for (label, value) in specs { out.append(labelRow(label, value, palette)) }
        }
        return out
    }

    /// What the model pane shows when there is no model to describe — a provider
    /// with no listed models (a local server, before it has been connected to), or
    /// no provider selected at all.
    public static func placeholder(_ text: String, palette: SemanticPalette) -> NSAttributedString {
        NSAttributedString(string: text, attributes: [
            .font: NSFont.systemFont(ofSize: 12),
            .foregroundColor: palette.nsColor(.tertiaryText),
            .paragraphStyle: proseStyle
        ])
    }

    // MARK: - Elements

    private static func eyebrow(_ text: String, _ palette: SemanticPalette) -> NSAttributedString {
        NSAttributedString(string: text.uppercased() + "\n", attributes: [
            .font: NSFont.systemFont(ofSize: 10, weight: .semibold),
            .foregroundColor: palette.nsColor(.tertiaryText),
            .kern: 0.9,
            .paragraphStyle: eyebrowStyle
        ])
    }

    private static func title(_ text: String, _ palette: SemanticPalette) -> NSAttributedString {
        NSAttributedString(string: text + "\n", attributes: [
            .font: NSFont.systemFont(ofSize: 15, weight: .bold),
            .foregroundColor: palette.primaryTextColor,
            .paragraphStyle: titleStyle
        ])
    }

    /// A section heading — the eyebrow style again, spaced away from what precedes
    /// it, so the pane reads as titled blocks rather than one column of text.
    private static func heading(_ text: String, _ palette: SemanticPalette) -> NSAttributedString {
        NSAttributedString(string: text.uppercased() + "\n", attributes: [
            .font: NSFont.systemFont(ofSize: 10, weight: .semibold),
            .foregroundColor: palette.nsColor(.tertiaryText),
            .kern: 0.9,
            .paragraphStyle: headingStyle
        ])
    }

    private static func prose(_ text: String, _ palette: SemanticPalette) -> NSAttributedString {
        NSAttributedString(string: text + "\n", attributes: [
            .font: NSFont.systemFont(ofSize: 12),
            .foregroundColor: palette.secondaryTextColor,
            .paragraphStyle: proseStyle
        ])
    }

    private static func labelRow(
        _ label: String, _ value: String, _ palette: SemanticPalette
    ) -> NSAttributedString {
        let out = NSMutableAttributedString(string: label + "\t", attributes: [
            .font: NSFont.systemFont(ofSize: 11),
            .foregroundColor: palette.nsColor(.tertiaryText),
            .paragraphStyle: rowStyle
        ])
        out.append(NSAttributedString(string: value + "\n", attributes: [
            .font: NSFont.systemFont(ofSize: 12),
            .foregroundColor: palette.primaryTextColor,
            .paragraphStyle: rowStyle
        ]))
        return out
    }

    /// A label row whose value is a clickable URL. Not underlined here — the text
    /// view's `linkTextAttributes` underline it, so the styling lives in one place
    /// and matches every other link in the app.
    private static func linkRow(
        _ label: String, _ url: String, _ palette: SemanticPalette
    ) -> NSAttributedString {
        let out = NSMutableAttributedString(string: label + "\t", attributes: [
            .font: NSFont.systemFont(ofSize: 11),
            .foregroundColor: palette.nsColor(.tertiaryText),
            .paragraphStyle: rowStyle
        ])
        var attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12),
            .foregroundColor: palette.accentColor,
            .paragraphStyle: rowStyle
        ]
        if let link = URL(string: url) { attrs[.link] = link }
        out.append(NSAttributedString(string: url + "\n", attributes: attrs))
        return out
    }

    /// Capability chips: tinted, padded runs on their own line. The padding is
    /// spaces inside the tinted run — a text attribute has no box model — so the
    /// fill has room to breathe around the word.
    private static func chipRow(_ titles: [String], _ palette: SemanticPalette) -> NSAttributedString {
        let out = NSMutableAttributedString()
        for (index, text) in titles.enumerated() {
            if index > 0 {
                out.append(NSAttributedString(string: " ", attributes: [
                    .font: NSFont.systemFont(ofSize: 10), .paragraphStyle: chipStyle
                ]))
            }
            out.append(NSAttributedString(string: "  \(text)  ", attributes: [
                .font: NSFont.systemFont(ofSize: 10, weight: .semibold),
                .foregroundColor: palette.accentColor,
                .backgroundColor: palette.accentColor.withAlphaComponent(0.16),
                .kern: 0.4,
                .paragraphStyle: chipStyle
            ]))
        }
        out.append(NSAttributedString(string: "\n", attributes: [.paragraphStyle: chipStyle]))
        return out
    }

    // MARK: - Paragraph styles

    /// Where every label row's value starts. Also the rows' `headIndent`, so a
    /// value that wraps (a long "Good for") lines up under itself.
    private static let valueColumn: CGFloat = 104

    private static let eyebrowStyle: NSParagraphStyle = {
        let style = NSMutableParagraphStyle()
        style.paragraphSpacing = 1
        return style
    }()

    private static let titleStyle: NSParagraphStyle = {
        let style = NSMutableParagraphStyle()
        style.paragraphSpacing = 6
        style.lineBreakMode = .byWordWrapping
        return style
    }()

    private static let headingStyle: NSParagraphStyle = {
        let style = NSMutableParagraphStyle()
        style.paragraphSpacingBefore = 14
        style.paragraphSpacing = 5
        return style
    }()

    private static let proseStyle: NSParagraphStyle = {
        let style = NSMutableParagraphStyle()
        style.lineSpacing = 2
        style.paragraphSpacing = 6
        return style
    }()

    private static let rowStyle: NSParagraphStyle = {
        let style = NSMutableParagraphStyle()
        style.tabStops = [NSTextTab(textAlignment: .left, location: valueColumn)]
        style.defaultTabInterval = valueColumn
        style.headIndent = valueColumn
        style.lineSpacing = 1
        style.paragraphSpacing = 3
        return style
    }()

    /// Chips sit on an unleaded line: `backgroundColor` fills the whole line
    /// height, so any line spacing here would stretch the tint into a tall block.
    private static let chipStyle: NSParagraphStyle = {
        let style = NSMutableParagraphStyle()
        style.lineSpacing = 0
        style.paragraphSpacingBefore = 3
        style.paragraphSpacing = 10
        return style
    }()
}
