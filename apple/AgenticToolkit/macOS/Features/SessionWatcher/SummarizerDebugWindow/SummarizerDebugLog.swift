import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

import AppKit
import Combine

extension SessionWatcher {
    /// In-memory log of summarizer activity, displayed in a debug window.
    public final class SummarizerDebugLog: ObservableObject, @unchecked Sendable {
        public static let shared = SummarizerDebugLog()
        
        @Published private(set) var entries: [String] = []
        
        public func append(_ message: String) {
            let ts = Self.timestampFormatter.string(from: Date())
            let line = "[\(ts)] \(message)"
            if Thread.isMainThread {
                entries.append(line)
            } else {
                DispatchQueue.main.async { self.entries.append(line) }
            }
        }
        
        public func clear() {
            entries.removeAll()
        }
        
        private static let timestampFormatter: DateFormatter = {
            let f = DateFormatter()
            f.dateFormat = "HH:mm:ss.SSS"
            return f
        }()
    }
}
