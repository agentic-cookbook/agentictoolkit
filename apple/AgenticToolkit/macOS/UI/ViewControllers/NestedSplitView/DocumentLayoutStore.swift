import Foundation
import SQLite3
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

public enum DocumentLayoutStoreError: Error {
    case openFailed(String)
    case prepareFailed(String)
    case executionFailed(String)
    case invalidSchema(String)
}

public struct LayoutNode {
    public indirect enum Kind {
        case split(orientation: String, first: LayoutNode, second: LayoutNode)
        case leaf(contentType: String, paneLabel: String?)
    }

    public let id: UUID
    public let kind: Kind

    public static func leaf(id: UUID = UUID(), contentType: String, paneLabel: String? = nil) -> LayoutNode {
        LayoutNode(id: id, kind: .leaf(contentType: contentType, paneLabel: paneLabel))
    }

    public static func split(id: UUID = UUID(), orientation: String, first: LayoutNode, second: LayoutNode) -> LayoutNode {
        LayoutNode(id: id, kind: .split(orientation: orientation, first: first, second: second))
    }
}

public struct TabRecord {
    public let id: UUID
    public var title: String
    public var root: LayoutNode
    public var focusedNodeID: UUID?

    public init(id: UUID = UUID(), title: String, root: LayoutNode, focusedNodeID: UUID? = nil) {
        self.id = id
        self.title = title
        self.root = root
        self.focusedNodeID = focusedNodeID
    }
}

public final class DocumentLayoutStore {

    private var db: OpaquePointer?
    public let databasePath: String

    public static let currentSchemaVersion = 2

    public init(path: String) throws {
        self.databasePath = path
        try openDatabase()
        try runMigrations()
    }

    deinit {
        if let db = db {
            sqlite3_close(db)
        }
    }

    private func openDatabase() throws {
        let result = sqlite3_open_v2(
            databasePath, &db,
            SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
            nil
        )
        guard result == SQLITE_OK else {
            throw DocumentLayoutStoreError.openFailed(lastErrorMessage)
        }
        try execute("PRAGMA journal_mode=WAL")
        try execute("PRAGMA foreign_keys=ON")
    }

    // MARK: - Migrations

    private func runMigrations() throws {
        try execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        let current = try schemaVersion()
        if current < 1 {
            try migration001_createTables()
        }
        if current < 2 {
            try migration002_addTabs()
        }
    }

    private func schemaVersion() throws -> Int {
        let sql = "SELECT COALESCE(MAX(version), 0) FROM schema_migrations"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DocumentLayoutStoreError.prepareFailed(lastErrorMessage)
        }
        guard sqlite3_step(stmt) == SQLITE_ROW else { return 0 }
        return Int(sqlite3_column_int(stmt, 0))
    }

    private func migration001_createTables() throws {
        try execute("""
            CREATE TABLE layout_nodes (
                id TEXT PRIMARY KEY,
                parent_id TEXT REFERENCES layout_nodes(id) ON DELETE CASCADE,
                position INTEGER NOT NULL,
                kind TEXT NOT NULL CHECK(kind IN ('split','leaf')),
                orientation TEXT,
                content_type TEXT,
                pane_label TEXT
            )
        """)
        try execute("CREATE INDEX idx_layout_nodes_parent ON layout_nodes(parent_id)")
        try execute("""
            CREATE TABLE layout_root (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                root_node_id TEXT REFERENCES layout_nodes(id)
            )
        """)
        try execute("INSERT INTO schema_migrations (version) VALUES (1)")
    }

    /// Adds multi-tab support. Each tab points at a layout-node tree root,
    /// optionally tracks a focused leaf, and the document remembers which
    /// tab was active. v1 documents (which had a single `layout_root`
    /// row) get migrated to a single tab pointing at the same root.
    private func migration002_addTabs() throws {
        try execute("""
            CREATE TABLE document_tabs (
                id TEXT PRIMARY KEY,
                position INTEGER NOT NULL,
                title TEXT NOT NULL,
                root_node_id TEXT REFERENCES layout_nodes(id),
                focused_node_id TEXT REFERENCES layout_nodes(id)
            )
        """)
        try execute("CREATE INDEX idx_document_tabs_position ON document_tabs(position)")
        try execute("""
            CREATE TABLE document_state (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                active_tab_id TEXT REFERENCES document_tabs(id)
            )
        """)

        // Migrate any existing v1 single-root layout into one tab.
        if let oldRoot: String = try queryScalarString("SELECT root_node_id FROM layout_root WHERE id = 1") {
            let tabID = UUID().uuidString
            let insertTab = "INSERT INTO document_tabs (id, position, title, root_node_id, focused_node_id) VALUES (?, 0, 'Tab 1', ?, NULL)"
            try executeBound(insertTab) { stmt in
                sqlite3_bind_text(stmt, 1, (tabID as NSString).utf8String, -1, nil)
                sqlite3_bind_text(stmt, 2, (oldRoot as NSString).utf8String, -1, nil)
            }
            try executeBound("INSERT INTO document_state (id, active_tab_id) VALUES (1, ?)") { stmt in
                sqlite3_bind_text(stmt, 1, (tabID as NSString).utf8String, -1, nil)
            }
        }

        try execute("DROP TABLE layout_root")
        try execute("INSERT INTO schema_migrations (version) VALUES (2)")
    }

    // MARK: - SQL helpers

    private var lastErrorMessage: String {
        if let db = db { return String(cString: sqlite3_errmsg(db)) }
        return "Database not open"
    }

    @discardableResult
    private func execute(_ sql: String) throws -> Int32 {
        var errorMessage: UnsafeMutablePointer<CChar>?
        let result = sqlite3_exec(db, sql, nil, nil, &errorMessage)
        if result != SQLITE_OK {
            let message = errorMessage.map { String(cString: $0) } ?? "Unknown error"
            sqlite3_free(errorMessage)
            throw DocumentLayoutStoreError.executionFailed(message)
        }
        return result
    }

    /// Prepares `sql`, lets `bind` populate parameters, then steps once.
    /// Throws on prepare or execution failure.
    private func executeBound(_ sql: String, bind: (OpaquePointer?) -> Void) throws {
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DocumentLayoutStoreError.prepareFailed(lastErrorMessage)
        }
        bind(stmt)
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw DocumentLayoutStoreError.executionFailed(lastErrorMessage)
        }
    }

    // MARK: - Tab persistence (v2)

    /// Returns every persisted tab (in display order) plus the active tab's
    /// id, or `(tabs: [], activeTabID: nil)` for a brand-new document.
    public func loadTabs() throws -> (tabs: [TabRecord], activeTabID: UUID?) {
        let allRows = try fetchAllNodeRows()
        let sql = "SELECT id, title, root_node_id, focused_node_id FROM document_tabs ORDER BY position"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DocumentLayoutStoreError.prepareFailed(lastErrorMessage)
        }
        var tabs: [TabRecord] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let idC = sqlite3_column_text(stmt, 0),
                  let id = UUID(uuidString: String(cString: idC)) else { continue }
            let title = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? ""
            guard let rootIDC = sqlite3_column_text(stmt, 2),
                  let rootID = UUID(uuidString: String(cString: rootIDC)) else { continue }
            let focusedNodeID: UUID? = sqlite3_column_text(stmt, 3)
                .flatMap { UUID(uuidString: String(cString: $0)) }
            let root = try buildTree(id: rootID, rows: allRows)
            tabs.append(TabRecord(id: id, title: title, root: root, focusedNodeID: focusedNodeID))
        }
        let activeTabID: UUID? = try queryScalarString("SELECT active_tab_id FROM document_state WHERE id = 1")
            .flatMap { UUID(uuidString: $0) }
        return (tabs, activeTabID)
    }

    public func saveTabs(_ tabs: [TabRecord], activeTabID: UUID?) throws {
        try execute("BEGIN IMMEDIATE TRANSACTION")
        do {
            try execute("DELETE FROM document_state")
            try execute("DELETE FROM document_tabs")
            try execute("DELETE FROM layout_nodes")
            for (index, tab) in tabs.enumerated() {
                try insertNode(tab.root, parentID: nil, position: 0)
                try executeBound("""
                    INSERT INTO document_tabs (id, position, title, root_node_id, focused_node_id)
                    VALUES (?, ?, ?, ?, ?)
                """) { stmt in
                    sqlite3_bind_text(stmt, 1, (tab.id.uuidString as NSString).utf8String, -1, nil)
                    sqlite3_bind_int(stmt, 2, Int32(index))
                    sqlite3_bind_text(stmt, 3, (tab.title as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(stmt, 4, (tab.root.id.uuidString as NSString).utf8String, -1, nil)
                    if let focused = tab.focusedNodeID {
                        sqlite3_bind_text(stmt, 5, (focused.uuidString as NSString).utf8String, -1, nil)
                    } else {
                        sqlite3_bind_null(stmt, 5)
                    }
                }
            }
            if let activeTabID, tabs.contains(where: { $0.id == activeTabID }) {
                try executeBound("INSERT INTO document_state (id, active_tab_id) VALUES (1, ?)") { stmt in
                    sqlite3_bind_text(stmt, 1, (activeTabID.uuidString as NSString).utf8String, -1, nil)
                }
            }
            try execute("COMMIT")
        } catch {
            _ = try? execute("ROLLBACK")
            throw error
        }
    }

    private func insertNode(_ node: LayoutNode, parentID: UUID?, position: Int) throws {
        let sql = """
            INSERT INTO layout_nodes (id, parent_id, position, kind, orientation, content_type, pane_label)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DocumentLayoutStoreError.prepareFailed(lastErrorMessage)
        }
        sqlite3_bind_text(stmt, 1, (node.id.uuidString as NSString).utf8String, -1, nil)
        if let parentID {
            sqlite3_bind_text(stmt, 2, (parentID.uuidString as NSString).utf8String, -1, nil)
        } else {
            sqlite3_bind_null(stmt, 2)
        }
        sqlite3_bind_int(stmt, 3, Int32(position))

        switch node.kind {
        case .split(let orientation, _, _):
            sqlite3_bind_text(stmt, 4, ("split" as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 5, (orientation as NSString).utf8String, -1, nil)
            sqlite3_bind_null(stmt, 6)
            sqlite3_bind_null(stmt, 7)
        case .leaf(let contentType, let paneLabel):
            sqlite3_bind_text(stmt, 4, ("leaf" as NSString).utf8String, -1, nil)
            sqlite3_bind_null(stmt, 5)
            sqlite3_bind_text(stmt, 6, (contentType as NSString).utf8String, -1, nil)
            if let paneLabel {
                sqlite3_bind_text(stmt, 7, (paneLabel as NSString).utf8String, -1, nil)
            } else {
                sqlite3_bind_null(stmt, 7)
            }
        }
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw DocumentLayoutStoreError.executionFailed(lastErrorMessage)
        }

        if case .split(_, let first, let second) = node.kind {
            try insertNode(first, parentID: node.id, position: 0)
            try insertNode(second, parentID: node.id, position: 1)
        }
    }

    // MARK: - Tree reconstruction

    private struct NodeRow {
        let id: UUID
        let parentID: UUID?
        let position: Int
        let kind: String
        let orientation: String?
        let contentType: String?
        let paneLabel: String?
    }

    private func fetchAllNodeRows() throws -> [UUID: NodeRow] {
        let sql = "SELECT id, parent_id, position, kind, orientation, content_type, pane_label FROM layout_nodes"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DocumentLayoutStoreError.prepareFailed(lastErrorMessage)
        }
        var rows: [UUID: NodeRow] = [:]
        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let idCString = sqlite3_column_text(stmt, 0),
                  let id = UUID(uuidString: String(cString: idCString)) else {
                continue
            }
            let parentID: UUID? = {
                guard let c = sqlite3_column_text(stmt, 1) else { return nil }
                return UUID(uuidString: String(cString: c))
            }()
            let position = Int(sqlite3_column_int(stmt, 2))
            let kind = sqlite3_column_text(stmt, 3).map { String(cString: $0) } ?? ""
            let orientation = sqlite3_column_text(stmt, 4).map { String(cString: $0) }
            let contentType = sqlite3_column_text(stmt, 5).map { String(cString: $0) }
            let paneLabel = sqlite3_column_text(stmt, 6).map { String(cString: $0) }
            rows[id] = NodeRow(
                id: id, parentID: parentID, position: position,
                kind: kind, orientation: orientation,
                contentType: contentType, paneLabel: paneLabel
            )
        }
        return rows
    }

    private func buildTree(id: UUID, rows: [UUID: NodeRow]) throws -> LayoutNode {
        guard let row = rows[id] else {
            throw DocumentLayoutStoreError.invalidSchema("missing node \(id)")
        }
        switch row.kind {
        case "leaf":
            let contentType = row.contentType ?? "whippet.placeholder"
            return LayoutNode(id: row.id, kind: .leaf(contentType: contentType, paneLabel: row.paneLabel))
        case "split":
            let children = rows.values
                .filter { $0.parentID == id }
                .sorted { $0.position < $1.position }
            guard children.count == 2 else {
                throw DocumentLayoutStoreError.invalidSchema("split \(id) has \(children.count) children")
            }
            let first = try buildTree(id: children[0].id, rows: rows)
            let second = try buildTree(id: children[1].id, rows: rows)
            let orientation = row.orientation ?? "horizontal"
            return LayoutNode(id: row.id, kind: .split(orientation: orientation, first: first, second: second))
        default:
            throw DocumentLayoutStoreError.invalidSchema("unknown kind \(row.kind)")
        }
    }

    private func queryScalarString(_ sql: String) throws -> String? {
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DocumentLayoutStoreError.prepareFailed(lastErrorMessage)
        }
        guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
        guard let c = sqlite3_column_text(stmt, 0) else { return nil }
        return String(cString: c)
    }
}
