//
//  SessionSources.swift
//  AgenticToolkit
//
//  The storage seams the Sessions window depends on. The window talks only to
//  these protocols, never to a concrete store, so it can be backed by the Whippet
//  SQLite database (in-app) or, in Stenographer, an HTTP-backed source over the
//  stenographerd daemon. All the work behind them — detection, summarization —
//  lives in each environment's own backend.
//

import Foundation

extension SessionWatcher {

    /// A read-only source of sessions for the Sessions window, plus a change signal.
    ///
    /// `fetchSessions()` is synchronous so the view model's reload path stays simple:
    /// a local DB read satisfies it directly, and an async/HTTP source satisfies it by
    /// returning a cached snapshot that its own refresh loop keeps fresh (then calls
    /// `onChange`).
    public protocol SessionListSource: AnyObject {
        /// The current set of sessions (the view model does its own grouping/filtering).
        func fetchSessions() throws -> [SessionWatcherSession]

        /// Begins delivering change notifications; `onChange` is invoked whenever the
        /// session set may have changed. Call again is a no-op-or-replace per source.
        /// `onChange` may be invoked on any thread, so it is `@Sendable`.
        func startObserving(onChange: @escaping @Sendable () -> Void)

        /// Stops delivering change notifications.
        func stopObserving()
    }

    /// Triggers AI summarization for a single session. *Where* the work runs is hidden
    /// behind this protocol: Whippet summarizes in-app; Stenographer asks the daemon
    /// over HTTP so summaries accrue even when the app isn't running.
    public protocol SessionSummarizing: AnyObject {
        /// Summarizes the session and persists the result to the underlying store.
        func summarize(sessionId: String) async throws
    }

    /// Posted when the sessions backing a Whippet-style store may have changed. The
    /// in-app writers (ingestion, liveness, summarizer) post it; the Whippet
    /// `SessionListSource` bridges it into `startObserving(onChange:)`. Sources that
    /// don't use NotificationCenter (e.g. an HTTP poller) ignore it entirely.
    public static let sessionsDidChangeNotification = Notification.Name("WhippetSessionsDidChange")

    /// Posts ``sessionsDidChangeNotification`` so observing sources reload.
    public static func notifySessionsChanged() {
        NotificationCenter.default.post(name: sessionsDidChangeNotification, object: nil)
    }
}
