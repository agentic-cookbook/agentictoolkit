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
        .library(
            name: "AgenticToolkitAIPluginsCore",
            type: .dynamic,
            targets: ["AgenticToolkitAIPluginsCore"]
        ),
    ],
    dependencies: [
        .package(path: "../AgenticToolkitCore"),
        .package(path: "../AgenticToolkitCoreUI"),
        .package(path: "../AgenticToolkitSettingsWindow"),
        .package(path: "../AgenticToolkitChatWindow"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitAIPluginsCore",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitSettingsWindow", package: "AgenticToolkitSettingsWindow"),
            ]
        ),
        .target(
            name: "AgenticToolkitAIPlugins",
            dependencies: [
                "AgenticToolkitAIPluginsCore",
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitCoreUI", package: "AgenticToolkitCoreUI"),
                .product(name: "AgenticToolkitSettingsWindow", package: "AgenticToolkitSettingsWindow"),
                .product(name: "AgenticToolkitChatWindow", package: "AgenticToolkitChatWindow"),
            ]
        ),
        .testTarget(
            name: "AgenticToolkitAIPluginsCoreTests",
            dependencies: ["AgenticToolkitAIPluginsCore"]
        ),
        .testTarget(
            name: "AgenticToolkitAIPluginsTests",
            dependencies: [
                "AgenticToolkitAIPlugins",
                "AgenticToolkitAIPluginsCore",
            ]
        ),
    ]
)
