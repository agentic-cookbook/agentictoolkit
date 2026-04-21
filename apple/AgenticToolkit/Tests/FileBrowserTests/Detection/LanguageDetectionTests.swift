import XCTest
@testable import FileBrowser
import CodeEditLanguages

final class LanguageDetectionTests: XCTestCase {
    override class func setUp() {
        super.setUp()
        // CodeEditLanguages ships a resource bundle via SwiftPM. When the
        // framework is statically bundled into a test binary, the
        // Bundle.module accessor can't locate the resource bundle through
        // its default search path. Set the override env var to the test
        // bundle's Resources directory, which is where the build copies
        // CodeEditLanguages_CodeEditLanguages.bundle.
        let testBundle = Bundle(for: LanguageDetectionTests.self)
        if let resourceURL = testBundle.resourceURL {
            setenv("PACKAGE_RESOURCE_BUNDLE_PATH", resourceURL.path, 1)
        }
    }

    override func setUp() {
        CustomFileTypeMappings.activeDefaultsKey = "AgenticFileBrowserTests.customMappings"
        UserDefaults.standard.removeObject(forKey: CustomFileTypeMappings.activeDefaultsKey)
        CustomFileTypeMappings.save([])
    }

    override func tearDown() {
        UserDefaults.standard.removeObject(forKey: CustomFileTypeMappings.activeDefaultsKey)
        CustomFileTypeMappings.save([])
    }

    func testBuiltinSwift() {
        let lang = LanguageDetection.language(for: URL(fileURLWithPath: "/tmp/x.swift"))
        XCTAssertEqual(lang.id, CodeLanguage.swift.id)
    }

    func testBuiltinJSON() {
        let lang = LanguageDetection.language(for: URL(fileURLWithPath: "/tmp/x.json"))
        XCTAssertEqual(lang.id, CodeLanguage.json.id)
    }

    func testCustomOverride() {
        CustomFileTypeMappings.save([
            CustomFileTypeMapping(fileExtension: "swift", languageName: "json", iconName: "curlybraces")
        ])
        let lang = LanguageDetection.language(for: URL(fileURLWithPath: "/tmp/x.swift"))
        XCTAssertEqual(lang.id, CodeLanguage.json.id)
    }
}
