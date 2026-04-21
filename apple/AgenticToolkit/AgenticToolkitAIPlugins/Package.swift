// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitAIPlugins",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitAIPlugins",
            type: .dynamic,
            targets: ["AgenticToolkitAIPlugins"]
        ),
    ],
    dependencies: [
        .package(path: "../AgenticToolkitCore"),
        .package(path: "../AgenticToolkitCoreUI"),
        .package(path: "../AgenticToolkitSettingsWindow"),
        .package(path: "../AgenticToolkitChatWindow"),
        .package(path: "../../AIPlugins/AgenticToolkitAIPluginsCore"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitAIPlugins",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitCoreUI", package: "AgenticToolkitCoreUI"),
                .product(name: "AgenticToolkitSettingsWindow", package: "AgenticToolkitSettingsWindow"),
                .product(name: "AgenticToolkitChatWindow", package: "AgenticToolkitChatWindow"),
                .product(name: "AgenticToolkitAIPluginsCore", package: "AgenticToolkitAIPluginsCore"),
            ],
            path: "Source"
        ),
        .testTarget(
            name: "AgenticToolkitAIPluginsTests",
            dependencies: [
                "AgenticToolkitAIPlugins",
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
            ],
            path: "Tests"
        ),
    ]
)
