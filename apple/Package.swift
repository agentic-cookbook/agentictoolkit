// swift-tools-version: 5.10
import PackageDescription

// SwiftPM wrapper that exposes AgenticFileBrowser (and its dependency
// AgenticToolkit) as library products, so host apps whose Xcode projects
// are not XcodeGen-managed can add this directory as a local SwiftPM
// dependency. XcodeGen (project.yml) remains the canonical build for
// in-repo development and testing.
let package = Package(
    name: "AgenticToolkitPackages",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "AgenticToolkit", targets: ["AgenticToolkit"]),
        .library(name: "AgenticFileBrowser", targets: ["AgenticFileBrowser"])
    ],
    dependencies: [
        .package(url: "https://github.com/CodeEditApp/CodeEditSourceEditor.git", from: "0.15.2"),
        .package(url: "https://github.com/CodeEditApp/CodeEditLanguages.git", exact: "0.1.20")
    ],
    targets: [
        .target(
            name: "AgenticToolkit",
            path: "Sources/AgenticToolkit"
        ),
        .target(
            name: "AgenticFileBrowser",
            dependencies: [
                "AgenticToolkit",
                .product(name: "CodeEditSourceEditor", package: "CodeEditSourceEditor"),
                .product(name: "CodeEditLanguages", package: "CodeEditLanguages")
            ],
            path: "Sources/AgenticFileBrowser"
        )
    ]
)
