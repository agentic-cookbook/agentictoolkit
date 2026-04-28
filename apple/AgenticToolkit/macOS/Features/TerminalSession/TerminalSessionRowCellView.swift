import AppKit
import Combine

/// A table cell view displaying a terminal session's status dot, title, and subtitle lines.
@MainActor
public final class TerminalSessionRowCellView: NSTableCellView {

    public static let identifier = NSUserInterfaceItemIdentifier("TerminalSessionRowCellView")

    private let dotView = NSView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let subtitleStack = NSStackView()
    private var cancellables = Set<AnyCancellable>()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setupViews()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        dotView.wantsLayer = true
        dotView.layer?.cornerRadius = 4
        dotView.translatesAutoresizingMaskIntoConstraints = false

        titleLabel.font = .systemFont(ofSize: NSFont.systemFontSize)
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.maximumNumberOfLines = 1
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        subtitleStack.orientation = .vertical
        subtitleStack.alignment = .leading
        subtitleStack.spacing = 2
        subtitleStack.translatesAutoresizingMaskIntoConstraints = false

        addSubview(dotView)
        addSubview(titleLabel)
        addSubview(subtitleStack)

        NSLayoutConstraint.activate([
            dotView.widthAnchor.constraint(equalToConstant: 8),
            dotView.heightAnchor.constraint(equalToConstant: 8),
            dotView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            dotView.topAnchor.constraint(equalTo: topAnchor, constant: 8),

            titleLabel.leadingAnchor.constraint(equalTo: dotView.trailingAnchor, constant: 6),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -4),
            titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 4),

            subtitleStack.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            subtitleStack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -4),
            subtitleStack.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 2),
            subtitleStack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -4),
        ])
    }

    public func configure(with session: TerminalSession) {
        cancellables.removeAll()

        Publishers.CombineLatest4(
            session.$state,
            session.$dotColor,
            session.$title.combineLatest(session.$name),
            session.$currentDirectory
        )
        .combineLatest(
            session.$gitBranch,
            session.$foregroundProcess,
            session.$customSubtitles
        )
        .combineLatest(session.$summary)
        .receive(on: RunLoop.main)
        .sink { [weak self] combined, summary in
            let (stateAndColors, branch, process, subtitles) = combined
            let (state, dotColor, titlePair, directory) = stateAndColors
            let (oscTitle, name) = titlePair

            MainActor.assumeIsolated {
                self?.dotView.layer?.backgroundColor = (state == .terminated ? NSColor.gray : dotColor).cgColor
                self?.titleLabel.stringValue = oscTitle ?? name

                self?.rebuildSubtitles(
                    directory: directory,
                    gitBranch: branch,
                    foregroundProcess: process,
                    customSubtitles: subtitles,
                    summary: summary
                )
            }
        }
        .store(in: &cancellables)
    }

    public override func prepareForReuse() {
        super.prepareForReuse()
        cancellables.removeAll()
        subtitleStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    }

    private func rebuildSubtitles(
        directory: String?,
        gitBranch: String?,
        foregroundProcess: String?,
        customSubtitles: [TerminalSessionSubtitle],
        summary: String?
    ) {
        subtitleStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        if let dir = tildeAbbreviate(directory) {
            subtitleStack.addArrangedSubview(makeSubtitleLine(icon: "folder", text: dir, truncation: .byTruncatingMiddle))
        }
        if let branch = gitBranch {
            subtitleStack.addArrangedSubview(makeSubtitleLine(icon: "arrow.triangle.branch", text: branch))
        }
        if let process = foregroundProcess {
            subtitleStack.addArrangedSubview(makeSubtitleLine(icon: "terminal", text: process))
        }
        for subtitle in customSubtitles {
            subtitleStack.addArrangedSubview(makeSubtitleLine(icon: "tag", text: subtitle.value))
        }
        if let summary = summary {
            subtitleStack.addArrangedSubview(makeSubtitleLine(icon: "brain", text: summary))
        }
    }

    private func makeSubtitleLine(icon: String, text: String, truncation: NSLineBreakMode = .byTruncatingTail) -> NSView {
        let imageView = NSImageView()
        if let image = NSImage(systemSymbolName: icon, accessibilityDescription: nil) {
            imageView.image = image
        }
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentTintColor = .secondaryLabelColor
        NSLayoutConstraint.activate([
            imageView.widthAnchor.constraint(equalToConstant: 12),
            imageView.heightAnchor.constraint(equalToConstant: 12),
        ])

        let label = NSTextField(labelWithString: text)
        label.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        label.textColor = .secondaryLabelColor
        label.lineBreakMode = truncation
        label.maximumNumberOfLines = 1

        let line = NSStackView(views: [imageView, label])
        line.orientation = .horizontal
        line.spacing = 4
        line.alignment = .centerY
        return line
    }

    private func tildeAbbreviate(_ path: String?) -> String? {
        guard let dir = path else { return nil }
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        if dir == home { return "~" }
        if dir.hasPrefix(home + "/") { return "~" + dir.dropFirst(home.count) }
        return dir
    }
}
