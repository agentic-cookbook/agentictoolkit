//
//  WhippetSessionListSource.swift
//  AgenticToolkit
//
//  Adapts the Whippet SQLite database to `SessionListSource`. Reads come straight
//  from the database; the change signal bridges the `sessionsDidChangeNotification`
//  that the in-app writers (ingestion, liveness, summarizer) post. Keeping this in an
//  adapter — rather than conforming the database manager directly — keeps the
//  NotificationCenter/UI concern out of the storage layer (and a Swift extension
//  couldn't hold the observer token anyway).
//

import Foundation

extension SessionWatcher {

    public final class WhippetSessionListSource: SessionListSource {

        private let databaseManager: SessionWatcherDatabaseManager
        private var observer: NSObjectProtocol?

        public init(databaseManager: SessionWatcherDatabaseManager) {
            self.databaseManager = databaseManager
        }

        deinit {
            stopObserving()
        }

        public func fetchSessions() throws -> [SessionWatcherSession] {
            try databaseManager.fetchAllSessions()
        }

        public func startObserving(onChange: @escaping @Sendable () -> Void) {
            stopObserving()
            observer = NotificationCenter.default.addObserver(
                forName: SessionWatcher.sessionsDidChangeNotification,
                object: nil,
                queue: nil
            ) { _ in
                onChange()
            }
        }

        public func stopObserving() {
            if let observer {
                NotificationCenter.default.removeObserver(observer)
                self.observer = nil
            }
        }
    }
}
