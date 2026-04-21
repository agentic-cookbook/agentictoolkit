// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitNotesWindow",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitNotesWindow",
            type: .dynamic,
            targets: ["AgenticToolkitNotesWindow"]
        ),
    ],
    dependencies: [
        .package(path: "../AgenticToolkitCore"),
        .package(path: "../AgenticToolkitCoreUI"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitNotesWindow",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitCoreUI", package: "AgenticToolkitCoreUI"),
            ],
            path: "Source"
        ),
    ]
)
