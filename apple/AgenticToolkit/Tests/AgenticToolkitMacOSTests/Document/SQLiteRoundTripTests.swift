import AgenticToolkitMacOS
import XCTest
@testable import AgenticToolkitMacOS

final class SQLiteRoundTripTests: XCTestCase {

    // MARK: - Project

    func testProjectRoundTripPreservesBasicFields() throws {
        var project = Project(
            name: "My Project",
            version: 2,
            createdDate: Date(timeIntervalSince1970: 1_700_000_000),
            settings: ProjectSettings()
        )
        project.settings.defaultShell = "/bin/bash"
        project.settings.autoOpenTerminal = false
        project.settings.isSessionPanelVisible = false
        project.settings.sessionPanelProportion = 0.25
        project.settings.fileTreeProportion = 0.30
        project.settings.isFileTreeVisible = false

        let data = try SQLiteProjectStore.serialize(project)
        let decoded = try SQLiteProjectStore.deserialize(data)

        XCTAssertEqual(decoded.name, "My Project")
        XCTAssertEqual(decoded.version, 2)
        XCTAssertEqual(decoded.createdDate.timeIntervalSince1970, 1_700_000_000, accuracy: 1.0)
        XCTAssertEqual(decoded.settings.defaultShell, "/bin/bash")
        XCTAssertFalse(decoded.settings.autoOpenTerminal)
        XCTAssertFalse(decoded.settings.isSessionPanelVisible)
        XCTAssertEqual(decoded.settings.sessionPanelProportion, 0.25, accuracy: 0.001)
        XCTAssertEqual(decoded.settings.fileTreeProportion, 0.30, accuracy: 0.001)
        XCTAssertFalse(decoded.settings.isFileTreeVisible)
    }

    func testProjectRoundTripPreservesSessionRecords() throws {
        var project = Project.newProject(name: "With Sessions")
        let layout = SessionLayoutState()
        project.sessionRecords = [
            SessionRecord(id: UUID(), name: "session-1", sortOrder: 0, layoutState: layout),
            SessionRecord(id: UUID(), name: "session-2", sortOrder: 1, layoutState: layout)
        ]

        let data = try SQLiteProjectStore.serialize(project)
        let decoded = try SQLiteProjectStore.deserialize(data)

        XCTAssertEqual(decoded.sessionRecords.count, 2)
        XCTAssertEqual(decoded.sessionRecords[0].name, "session-1")
        XCTAssertEqual(decoded.sessionRecords[0].sortOrder, 0)
        XCTAssertEqual(decoded.sessionRecords[1].name, "session-2")
        XCTAssertEqual(decoded.sessionRecords[1].sortOrder, 1)
    }

    func testProjectRoundTripPreservesDefaultSessionLayout() throws {
        var project = Project.newProject(name: "Layout Test")
        project.settings.defaultSessionLayout.addPane(.terminal)

        let data = try SQLiteProjectStore.serialize(project)
        let decoded = try SQLiteProjectStore.deserialize(data)

        XCTAssertEqual(decoded.settings.defaultSessionLayout, project.settings.defaultSessionLayout)
    }

    // MARK: - Workspace

    func testWorkspaceRoundTripPreservesBasicFields() throws {
        let workspace = Workspace(
            name: "My Workspace",
            version: 1,
            createdDate: Date(timeIntervalSince1970: 1_700_000_000),
            entries: [],
            discoveredProjects: [],
            settings: WorkspaceSettings()
        )

        let data = try SQLiteWorkspaceStore.serialize(workspace)
        let decoded = try SQLiteWorkspaceStore.deserialize(data)

        XCTAssertEqual(decoded.name, "My Workspace")
        XCTAssertEqual(decoded.version, 1)
        XCTAssertEqual(decoded.createdDate.timeIntervalSince1970, 1_700_000_000, accuracy: 1.0)
    }

    func testWorkspaceRoundTripPreservesEntriesAndDiscoveredProjects() throws {
        let added = Date(timeIntervalSince1970: 1_700_000_000)
        let workspace = Workspace(
            name: "Workspace",
            version: 1,
            createdDate: added,
            entries: [
                WorkspaceEntry(id: 1, type: .directory, path: "/tmp/a", name: "a", addedDate: added),
                WorkspaceEntry(id: 2, type: .project, path: "/tmp/b.catnip-proj", name: "b", addedDate: added)
            ],
            discoveredProjects: [
                DiscoveredProject(id: 1, entryID: 1, projectPath: "/tmp/a/x.catnip-proj", projectName: "x", lastSeen: added)
            ],
            settings: WorkspaceSettings()
        )

        let data = try SQLiteWorkspaceStore.serialize(workspace)
        let decoded = try SQLiteWorkspaceStore.deserialize(data)

        XCTAssertEqual(decoded.entries.count, 2)
        XCTAssertEqual(decoded.entries[0].name, "a")
        XCTAssertEqual(decoded.entries[0].type, .directory)
        XCTAssertEqual(decoded.entries[1].name, "b")
        XCTAssertEqual(decoded.entries[1].type, .project)
        XCTAssertEqual(decoded.discoveredProjects.count, 1)
        XCTAssertEqual(decoded.discoveredProjects[0].projectName, "x")
        XCTAssertEqual(decoded.discoveredProjects[0].entryID, 1)
    }

    func testWorkspaceSettingsRoundTrip() throws {
        var workspace = Workspace.newWorkspace(name: "Settings")
        workspace.settings.sidebarProportion = 0.42

        let data = try SQLiteWorkspaceStore.serialize(workspace)
        let decoded = try SQLiteWorkspaceStore.deserialize(data)

        XCTAssertEqual(decoded.settings.sidebarProportion, 0.42, accuracy: 0.001)
    }
}
