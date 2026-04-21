// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitFileBrowser",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitFileBrowser",
            type: .dynamic,
            targets: ["AgenticToolkitFileBrowser"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/CodeEditApp/CodeEditSourceEditor.git", from: "0.15.2"),
        .package(url: "https://github.com/CodeEditApp/CodeEditLanguages.git", exact: "0.1.20"),
        .package(path: "../AgenticToolkitCore"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitFileBrowser",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "CodeEditSourceEditor", package: "CodeEditSourceEditor"),
                .product(name: "CodeEditLanguages", package: "CodeEditLanguages"),
            ],
            path: "Source"
        ),
        .testTarget(
            name: "AgenticToolkitFileBrowserTests",
            dependencies: [
                "AgenticToolkitFileBrowser",
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
            ],
            path: "Tests"
        ),
    ]
)
