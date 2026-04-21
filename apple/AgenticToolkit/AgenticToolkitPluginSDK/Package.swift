// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitPluginSDK",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitPluginSDK",
            type: .dynamic,
            targets: ["AgenticToolkitPluginSDK"]
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
            name: "AgenticToolkitPluginSDK",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitCoreUI", package: "AgenticToolkitCoreUI"),
                .product(name: "AgenticToolkitSettingsWindow", package: "AgenticToolkitSettingsWindow"),
                .product(name: "AgenticToolkitChatWindow", package: "AgenticToolkitChatWindow"),
            ],
            path: "Source"
        ),
        .testTarget(
            name: "AgenticToolkitPluginSDKTests",
            dependencies: [
                "AgenticToolkitPluginSDK",
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
            ],
            path: "Tests"
        ),
    ]
)
