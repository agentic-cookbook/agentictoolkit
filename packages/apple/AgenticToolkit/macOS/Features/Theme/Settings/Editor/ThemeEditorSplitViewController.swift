import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The theme editor's topic list: Details, Colors, Project, Typography,
/// Terminal, all editing the one `ThemeEditorContext`.
///
/// A split rather than a long scroll of cards, because a theme has five
/// unrelated kinds of thing in it and scrolling past four to reach the fifth is
/// how the old single-column editor read.
@MainActor
final class ThemeEditorSplitViewController: ComposableSettings.SplitViewController {

    private let topics: [ThemeTopicPanel]

    init(context: ThemeEditorContext, onRenamed: @escaping (String) -> Void) {
        self.topics = [
            ThemeDetailsTopicPanel(context: context, onRenamed: onRenamed),
            ThemeColorsTopicPanel(context: context),
            ThemeProjectTopicPanel(context: context),
            ThemeTypographyTopicPanel(context: context),
            ThemeTerminalTopicPanel(context: context)
        ]
        super.init()
        sidebarTitle = nil
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    /// A modest floor so the topic content can't be squeezed to a sliver, well
    /// under the window's own so it never compounds the minimum width.
    override var detailMinimumThickness: CGFloat { 200 }

    /// Content-sized: the five titles are short and fixed, and a divider the
    /// user drags inside a tab inside a panel is not a width worth remembering.
    override var contentSizedSidebar: Bool { true }

    override var sidebarAutosaveName: String? { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        topics.forEach { addPanel($0) }
        selectPanel(at: 0)
    }
}
