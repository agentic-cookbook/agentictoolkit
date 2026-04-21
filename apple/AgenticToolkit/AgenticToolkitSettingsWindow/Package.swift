// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitSettingsWindow",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitSettingsWindow",
            type: .dynamic,
            targets: ["AgenticToolkitSettingsWindow"]
        ),
    ],
    dependencies: [
        .package(path: "../AgenticToolkitCore"),
        .package(path: "../AgenticToolkitCoreUI"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitSettingsWindow",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitCoreUI", package: "AgenticToolkitCoreUI"),
            ],
            path: "Source"
        ),
    ]
)
