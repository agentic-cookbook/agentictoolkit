import XCTest
@testable import AgenticToolkit

final class SessionRowViewTests: XCTestCase {

    // MARK: - Card Layout

    func testCardStretchesToParentWidth() {
        let parentWidth: CGFloat = 400
        let session = Session(sessionId: "s1", cwd: "/Users/test/MyProject", status: .active)
        let row = SessionRowAppKitView(
            session: session,
            onTap: nil,
            isSummarizing: false,
            onSummarize: nil,
            isFrontmost: false
        )
        row.translatesAutoresizingMaskIntoConstraints = false

        let container = NSView(frame: NSRect(x: 0, y: 0, width: parentWidth, height: 500))
        container.addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            row.topAnchor.constraint(equalTo: container.topAnchor),
        ])
        container.layoutSubtreeIfNeeded()

        XCTAssertEqual(row.frame.width, parentWidth, accuracy: 1,
                       "Card must stretch to fill parent width")
    }

    func testCardHasMinimumPadding() {
        let session = Session(sessionId: "s1", cwd: "/Users/test/Project", status: .active)
        let row = SessionRowAppKitView(
            session: session,
            onTap: nil,
            isSummarizing: false,
            onSummarize: nil,
            isFrontmost: false
        )
        row.translatesAutoresizingMaskIntoConstraints = false

        let container = NSView(frame: NSRect(x: 0, y: 0, width: 400, height: 500))
        container.addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            row.topAnchor.constraint(equalTo: container.topAnchor),
        ])
        container.layoutSubtreeIfNeeded()

        // Find the first label (project name) — it should have at least 10pt left padding
        let projectLabel = findFirstTextField(in: row)
        XCTAssertNotNil(projectLabel, "Card must contain a text field")
        if let label = projectLabel {
            let labelFrame = label.convert(label.bounds, to: row)
            XCTAssertGreaterThanOrEqual(labelFrame.origin.x, 10,
                                        "Content must have at least 10pt left padding")
        }
    }

    // MARK: - Project Name First

    func testProjectNameIsFirstElement() {
        let session = Session(sessionId: "s1", cwd: "/Users/test/MyProject", status: .active)
        let row = SessionRowAppKitView(
            session: session,
            onTap: nil,
            isSummarizing: false,
            onSummarize: nil,
            isFrontmost: false
        )
        row.translatesAutoresizingMaskIntoConstraints = false

        let container = NSView(frame: NSRect(x: 0, y: 0, width: 400, height: 500))
        container.addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            row.topAnchor.constraint(equalTo: container.topAnchor),
        ])
        container.layoutSubtreeIfNeeded()

        // Find all text fields, the first should be the project name
        let labels = findAllTextFields(in: row)
        XCTAssertGreaterThanOrEqual(labels.count, 1)
        XCTAssertEqual(labels.first?.stringValue, "MyProject",
                       "Project name must be the first text element in the card")
    }

    // MARK: - Summary Display

    func testShowsThinkingWhenNoSummary() {
        let session = Session(sessionId: "s1", cwd: "/Users/test/Proj", status: .active, summary: "")
        let row = SessionRowAppKitView(
            session: session,
            onTap: nil,
            isSummarizing: false,
            onSummarize: nil,
            isFrontmost: false
        )
        row.translatesAutoresizingMaskIntoConstraints = false

        let container = NSView(frame: NSRect(x: 0, y: 0, width: 400, height: 500))
        container.addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            row.topAnchor.constraint(equalTo: container.topAnchor),
        ])
        container.layoutSubtreeIfNeeded()

        let labels = findAllTextFields(in: row)
        let thinkingLabel = labels.first { $0.stringValue == "thinking..." }
        XCTAssertNotNil(thinkingLabel, "Card must show 'thinking...' when no summary exists")
    }

    func testShowsSummaryWhenAvailable() {
        let session = Session(sessionId: "s1", cwd: "/Users/test/Proj",
                              status: .active, summary: "fixing the session layout")
        let row = SessionRowAppKitView(
            session: session,
            onTap: nil,
            isSummarizing: false,
            onSummarize: nil,
            isFrontmost: false
        )
        row.translatesAutoresizingMaskIntoConstraints = false

        let container = NSView(frame: NSRect(x: 0, y: 0, width: 400, height: 500))
        container.addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            row.topAnchor.constraint(equalTo: container.topAnchor),
        ])
        container.layoutSubtreeIfNeeded()

        let labels = findAllTextFields(in: row)
        let summaryLabel = labels.first { $0.stringValue == "fixing the session layout" }
        XCTAssertNotNil(summaryLabel, "Card must show the AI summary when available")
    }

    // MARK: - Detail Lines

    func testShowsWorkingDirectory() {
        let session = Session(sessionId: "s1", cwd: "/Users/test/projects/MyApp", status: .active)
        let row = makeRow(session: session)

        let labels = findAllTextFields(in: row)
        let cwdLabel = labels.first { $0.stringValue.contains("projects/MyApp") }
        XCTAssertNotNil(cwdLabel, "Card must show the working directory")
    }

    func testShowsGitBranch() {
        let session = Session(sessionId: "s1", cwd: "/Users/test/proj",
                              status: .active, gitBranch: "feature/login")
        let row = makeRow(session: session)

        let labels = findAllTextFields(in: row)
        let branchLabel = labels.first { $0.stringValue == "feature/login" }
        XCTAssertNotNil(branchLabel, "Card must show the git branch")
    }

    func testShowsSessionId() {
        let session = Session(sessionId: "abc-123-def", cwd: "/Users/test/proj", status: .active)
        let row = makeRow(session: session)

        let labels = findAllTextFields(in: row)
        let idLabel = labels.first { $0.stringValue == "abc-123-def" }
        XCTAssertNotNil(idLabel, "Card must show the session ID")
    }

    // MARK: - Helpers

    private func makeRow(session: Session) -> SessionRowAppKitView {
        let row = SessionRowAppKitView(
            session: session,
            onTap: nil,
            isSummarizing: false,
            onSummarize: nil,
            isFrontmost: false
        )
        row.translatesAutoresizingMaskIntoConstraints = false
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 400, height: 500))
        container.addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            row.topAnchor.constraint(equalTo: container.topAnchor),
        ])
        container.layoutSubtreeIfNeeded()
        return row
    }

    private func findFirstTextField(in view: NSView) -> NSTextField? {
        for subview in view.subviews {
            if let tf = subview as? NSTextField { return tf }
            if let found = findFirstTextField(in: subview) { return found }
        }
        return nil
    }

    private func findAllTextFields(in view: NSView) -> [NSTextField] {
        var result: [NSTextField] = []
        for subview in view.subviews {
            if let tf = subview as? NSTextField { result.append(tf) }
            result.append(contentsOf: findAllTextFields(in: subview))
        }
        return result
    }

}
