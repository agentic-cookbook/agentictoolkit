import AppKit

extension ComposableSettings {

    /// A multi-line editor for settings whose value is a body of text rather than
    /// a field's worth — an LLM prompt, a template, a script snippet.
    ///
    /// Unlike ``TextEditView`` (one `NSTextField`, commits on Return), the value is
    /// written back when editing *ends* — focus leaves, or the panel closes. Return
    /// inserts a newline here, so committing per keystroke or per Return would be
    /// wrong twice over: it would fight the user mid-sentence, and for settings that
    /// are pushed somewhere on change it would emit a write per character.
    @MainActor
    public class TextAreaEditView: NSView, SettingsViewProtocol, NSTextViewDelegate {

        public let label: NSTextField
        public let textView: NSTextView

        private let viewModel: ViewModel<String>
        private let scrollView = NSScrollView()

        /// - Parameters:
        ///   - viewModel: supplies the title and the backing setting.
        ///   - visibleLines: height of the editor, in lines of the editing font.
        ///     Text beyond it scrolls.
        ///   - monospaced: use a fixed-width font — right for prompts and code,
        ///     wrong for prose.
        public init(with viewModel: ViewModel<String>, visibleLines: Int = 6, monospaced: Bool = false) {
            self.viewModel = viewModel
            self.label = TextEditView.createLabel(title: viewModel.title)
            self.textView = NSTextView()

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            let font: NSFont = monospaced
                ? .monospacedSystemFont(ofSize: 12, weight: .regular)
                : .systemFont(ofSize: 12)
            self.textView.font = font
            self.textView.string = viewModel.value
            self.textView.delegate = self
            self.textView.isRichText = false
            self.textView.allowsUndo = true
            // Editing a prompt is prose typing, not code entry: the automatic
            // substitutions would silently swap quotes and dashes into text that
            // gets sent to a model verbatim.
            self.textView.isAutomaticQuoteSubstitutionEnabled = false
            self.textView.isAutomaticDashSubstitutionEnabled = false
            self.textView.isAutomaticTextReplacementEnabled = false
            self.textView.textContainerInset = NSSize(width: 4, height: 4)
            // The documented programmatic setup for a text view that grows
            // downward inside a scroll view and wraps to its width.
            self.textView.minSize = NSSize(width: 0, height: 0)
            self.textView.maxSize = NSSize(
                width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
            self.textView.isVerticallyResizable = true
            self.textView.isHorizontallyResizable = false
            self.textView.autoresizingMask = [.width]
            self.textView.textContainer?.containerSize = NSSize(
                width: 0, height: CGFloat.greatestFiniteMagnitude)
            self.textView.textContainer?.widthTracksTextView = true

            self.scrollView.translatesAutoresizingMaskIntoConstraints = false
            self.scrollView.documentView = self.textView
            self.scrollView.hasVerticalScroller = true
            self.scrollView.borderType = .bezelBorder
            self.scrollView.drawsBackground = true

            let stack = NSStackView(views: [self.label, self.scrollView])
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = SettingsLayout.default[.rowSpacing]
            stack.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(stack)
            Self.pinToEdges(stack, of: self)

            let lineHeight = font.boundingRectForFont.height
            NSLayoutConstraint.activate([
                self.scrollView.widthAnchor.constraint(equalTo: stack.widthAnchor),
                self.scrollView.heightAnchor.constraint(
                    equalToConstant: (lineHeight * CGFloat(visibleLines)).rounded() + 8)
            ])

            viewModel.onChange = { [weak self] _ in
                guard let self else { return }
                self.label.stringValue = viewModel.title
                // A reset (or another window) changed the setting underneath us.
                // Don't stomp on text the user is in the middle of typing.
                guard self.textView.string != viewModel.value else { return }
                if self.window?.firstResponder !== self.textView {
                    self.textView.string = viewModel.value
                }
            }

            // The visible label isn't associated with the text view by AppKit, so
            // VoiceOver would otherwise announce an unnamed editor.
            self.textView.setAccessibilityLabel(viewModel.title)
        }

        /// The enclosing stack aligns `.leading`, so claim the full width — a text
        /// area that is only as wide as its longest line is unusable for editing.
        public override func viewDidMoveToSuperview() {
            super.viewDidMoveToSuperview()
            guard let parent = self.superview else { return }
            self.widthAnchor.constraint(equalTo: parent.widthAnchor).isActive = true
        }

        public func textDidEndEditing(_ notification: Notification) {
            commit()
        }

        /// Write the editor's text to the setting. Called when editing ends; also
        /// callable by a host that has to persist before the field resigns first
        /// responder (closing a window out from under an active editor).
        public func commit() {
            let newValue = self.textView.string
            if viewModel.settingObserver.value != newValue {
                viewModel.settingObserver.value = newValue
            }
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }
    }
}
