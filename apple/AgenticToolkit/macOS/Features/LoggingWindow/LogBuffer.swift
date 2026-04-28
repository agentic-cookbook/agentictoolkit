import Foundation

/// Default in-memory ``LogProvider`` — a capped FIFO of ``LogLine``s.
///
/// Safe to drive from main-actor code only. Appends that exceed
/// ``maxLines`` drop the oldest rows so the view keeps bounded memory
/// and scrolling cost.
@MainActor
public final class LogBuffer: LogProvider {
    public let columns: [LogColumn]
    public private(set) var lines: [LogLine] = []
    public let maxLines: Int
    public weak var delegate: LogProviderDelegate?

    public init(columns: [LogColumn], maxLines: Int = 5000) {
        precondition(maxLines > 0, "maxLines must be positive")
        self.columns = columns
        self.maxLines = maxLines
    }

    public func append(_ line: LogLine) {
        append(contentsOf: [line])
    }

    public func append(contentsOf newLines: [LogLine]) {
        guard !newLines.isEmpty else { return }
        lines.append(contentsOf: newLines)
        trim()
        delegate?.logProvider(self, didChange: .appended(count: newLines.count))
    }

    public func replace(with newLines: [LogLine]) {
        lines = newLines
        trim()
        delegate?.logProvider(self, didChange: .replaced)
    }

    public func clear() {
        guard !lines.isEmpty else { return }
        lines.removeAll()
        delegate?.logProvider(self, didChange: .cleared)
    }

    private func trim() {
        if lines.count > maxLines {
            lines.removeFirst(lines.count - maxLines)
        }
    }
}
