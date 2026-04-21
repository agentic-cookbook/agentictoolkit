// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitChatWindow",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitChatWindow",
            type: .dynamic,
            targets: ["AgenticToolkitChatWindow"]
        ),
    ],
    dependencies: [
        .package(path: "../AgenticToolkitCore"),
        .package(path: "../AgenticToolkitCoreUI"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitChatWindow",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitCoreUI", package: "AgenticToolkitCoreUI"),
            ],
            path: "Source"
        ),
    ]
)
