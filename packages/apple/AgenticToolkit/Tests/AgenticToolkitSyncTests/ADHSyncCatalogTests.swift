import XCTest
@testable import AgenticToolkitSync

final class ADHSyncCatalogTests: XCTestCase {
    func testCatalogShape() {
        XCTAssertEqual(ADHSyncCatalog.all.count, 79)
        XCTAssertEqual(ADHSyncCatalog.pullOnly.count, 27)
        // pullOnly ⊆ all
        let names = Set(ADHSyncCatalog.all.map(\.resource))
        XCTAssertTrue(ADHSyncCatalog.pullOnly.isSubset(of: names))
        // no duplicates
        XCTAssertEqual(names.count, ADHSyncCatalog.all.count)
        // spot checks: the enrollment branch's 10 tables are present
        for resource in ["content.feed", "content.poll_votes", "content.reactions",
                         "content.papers", "notification.notifications", "social.follows",
                         "social.user_blocks", "project.participants",
                         "discussion.community_members", "persona_memory.links"] {
            XCTAssertTrue(names.contains(resource), resource)
        }
        // push-mode spot checks
        XCTAssertTrue(ADHSyncCatalog.pullOnly.contains("social.follows"))
        XCTAssertFalse(ADHSyncCatalog.pullOnly.contains("content.contacts"))
        // all v1 today
        XCTAssertTrue(ADHSyncCatalog.all.allSatisfy { $0.schemaVersion == 1 })
    }
}
