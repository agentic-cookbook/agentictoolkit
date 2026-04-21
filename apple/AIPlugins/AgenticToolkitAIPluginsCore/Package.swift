// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitAIPluginsCore",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitAIPluginsCore",
            type: .dynamic,
            targets: ["AgenticToolkitAIPluginsCore"]
        ),
    ],
    dependencies: [
        .package(path: "../../AgenticToolkit/AgenticToolkitCore"),
        .package(path: "../../AgenticToolkit/AgenticToolkitSettingsWindow"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitAIPluginsCore",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitSettingsWindow", package: "AgenticToolkitSettingsWindow"),
            ],
            path: "Source"
        ),
        .testTarget(
            name: "AgenticToolkitAIPluginsCoreTests",
            dependencies: ["AgenticToolkitAIPluginsCore"],
            path: "Tests"
        ),
    ]
)
