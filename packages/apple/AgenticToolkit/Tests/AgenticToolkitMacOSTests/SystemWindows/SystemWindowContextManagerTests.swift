import Testing
import Foundation
import CoreGraphics
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

@MainActor
@Suite("SystemWindowContextManager")
struct SystemWindowContextManagerTests {

    /// In-memory window controller that records mutations and serves a fixed window list.
    final class MockWindowControl: SystemWindowControlling {
        var windows: [SystemWindowInfo]
        private(set) var moved: [(id: UInt32, point: CGPoint)] = []
        private(set) var framed: [(id: UInt32, frame: CGRect)] = []
        private(set) var focused: [UInt32] = []

        init(windows: [SystemWindowInfo] = []) { self.windows = windows }

        func listWindows() -> [SystemWindowInfo] { windows }
        func listAllWindows() -> [SystemWindowInfo] { windows }
        func move(windowID: UInt32, to point: CGPoint) throws { moved.append((windowID, point)) }
        func resize(windowID: UInt32, to size: CGSize) throws {}
        func focus(windowID: UInt32) throws { focused.append(windowID) }
        func setFrame(windowID: UInt32, to frame: CGRect) throws { framed.append((windowID, frame)) }

        func reset() { moved.removeAll(); framed.removeAll(); focused.removeAll() }
    }

    private func makeManager(_ control: MockWindowControl) -> (SystemWindowContextManager, URL) {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let store = SystemWindowContextStore(rootDirectory: dir)
        return (SystemWindowContextManager(windowManager: control, stateStore: store), dir)
    }

    private func window(id: UInt32, app: String, title: String = "w", originX: CGFloat = 100) -> SystemWindowInfo {
        SystemWindowInfo(
            id: id, app: app, pid: 1, title: title,
            frame: CGRect(x: originX, y: 50, width: 400, height: 300),
            display: 0, isOnScreen: true, layer: 0
        )
    }

    @Test("adding a window to an inactive context parks it off-screen")
    func addToInactiveParks() throws {
        let control = MockWindowControl(windows: [
            window(id: 1, app: "Xcode"), window(id: 2, app: "Warp")
        ])
        let (manager, dir) = makeManager(control)
        defer { try? FileManager.default.removeItem(at: dir) }

        let active = try manager.createContext(name: "Active")
        let inactive = try manager.createContext(name: "Inactive")
        try manager.switchContext(to: active.id)
        control.reset()

        try manager.addWindow(windowID: 2, to: inactive.id)
        #expect(control.moved.contains { $0.id == 2 })
    }

    @Test("adding a window with no active context does not park it")
    func addWithNoActiveContextDoesNotPark() throws {
        let control = MockWindowControl(windows: [window(id: 1, app: "Xcode")])
        let (manager, dir) = makeManager(control)
        defer { try? FileManager.default.removeItem(at: dir) }

        let context = try manager.createContext(name: "C")
        control.reset()
        try manager.addWindow(windowID: 1, to: context.id)
        #expect(control.moved.isEmpty)
    }

    @Test("deleting the active context restores every context's windows")
    func deleteActiveRestoresAll() throws {
        let control = MockWindowControl(windows: [
            window(id: 1, app: "Xcode"), window(id: 2, app: "Warp")
        ])
        let (manager, dir) = makeManager(control)
        defer { try? FileManager.default.removeItem(at: dir) }

        let active = try manager.createContext(name: "Active")
        let other = try manager.createContext(name: "Other")
        try manager.addWindow(windowID: 1, to: active.id)
        try manager.addWindow(windowID: 2, to: other.id)
        try manager.switchContext(to: active.id) // parks 'other' (window 2)
        control.reset()

        try manager.deleteContext(id: active.id)
        #expect(manager.activeContextID == nil)
        // Both the deleted context's window and the previously-parked one are restored.
        #expect(control.framed.contains { $0.id == 1 })
        #expect(control.framed.contains { $0.id == 2 })
    }

    @Test("stale persisted window IDs are invalidated on load")
    func reconcileStaleIDsOnLoad() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = SystemWindowContextStore(rootDirectory: dir)

        // Seed: a snapshot whose live windowID is 99.
        let seedControl = MockWindowControl(windows: [window(id: 99, app: "Xcode")])
        let seed = SystemWindowContextManager(windowManager: seedControl, stateStore: store)
        let context = try seed.createContext(name: "C")
        try seed.addWindow(windowID: 99, to: context.id)

        // Reload with a window list that no longer contains 99 -> it must be invalidated.
        let control = MockWindowControl(windows: [window(id: 7, app: "Xcode")])
        let manager = SystemWindowContextManager(windowManager: control, stateStore: store)
        try manager.loadState()

        #expect(manager.hasStaleWindows)
    }

    @Test("a persisted window ID recycled to a different app is invalidated on load")
    func reconcileRecycledIDOnLoad() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = SystemWindowContextStore(rootDirectory: dir)

        let seedControl = MockWindowControl(windows: [window(id: 42, app: "Xcode")])
        let seed = SystemWindowContextManager(windowManager: seedControl, stateStore: store)
        let context = try seed.createContext(name: "C")
        try seed.addWindow(windowID: 42, to: context.id)

        // ID 42 still exists live, but now belongs to a different app -> invalidate.
        let control = MockWindowControl(windows: [window(id: 42, app: "Finder")])
        let manager = SystemWindowContextManager(windowManager: control, stateStore: store)
        try manager.loadState()

        #expect(manager.hasStaleWindows)
    }
}
