import Foundation

/// SyncTransport fake: queue up pull/push outcomes; records requests.
public actor ScriptedSyncTransport: SyncTransport {
    public enum Outcome<T: Sendable>: Sendable {
        case success(T)
        case failure(SyncTransportError)
    }

    private var pullScript: [Outcome<SyncPullResponse>]
    private var pushScript: [Outcome<SyncPushResponse>]
    public private(set) var pullCursors: [SyncCursor?] = []
    public private(set) var pushedRequests: [SyncPushRequest] = []

    public init(pulls: [Outcome<SyncPullResponse>] = [], pushes: [Outcome<SyncPushResponse>] = []) {
        self.pullScript = pulls
        self.pushScript = pushes
    }

    public func enqueuePull(_ outcome: Outcome<SyncPullResponse>) { pullScript.append(outcome) }
    public func enqueuePush(_ outcome: Outcome<SyncPushResponse>) { pushScript.append(outcome) }

    public func pull(cursor: SyncCursor?, limit: Int) async throws -> SyncPullResponse {
        pullCursors.append(cursor)
        guard !pullScript.isEmpty else {
            return SyncPullResponse(manifest: [], changes: [], cursor: cursor?.rawValue ?? "empty", hasMore: false)
        }
        switch pullScript.removeFirst() {
        case .success(let response): return response
        case .failure(let error): throw error
        }
    }

    public func push(_ request: SyncPushRequest) async throws -> SyncPushResponse {
        pushedRequests.append(request)
        guard !pushScript.isEmpty else {
            let applied = request.ops.map { SyncPushResult(opId: $0.opId, status: .applied) }
            return SyncPushResponse(results: applied, watermark: "0")
        }
        switch pushScript.removeFirst() {
        case .success(let response): return response
        case .failure(let error): throw error
        }
    }
}
