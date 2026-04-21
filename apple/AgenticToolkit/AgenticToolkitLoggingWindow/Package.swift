// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitLoggingWindow",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitLoggingWindow",
            type: .dynamic,
            targets: ["AgenticToolkitLoggingWindow"]
        ),
    ],
    dependencies: [
        .package(path: "../AgenticToolkitCore"),
        .package(path: "../AgenticToolkitCoreUI"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitLoggingWindow",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitCoreUI", package: "AgenticToolkitCoreUI"),
            ],
            path: "Source"
        ),
        .testTarget(
            name: "AgenticToolkitLoggingWindowTests",
            dependencies: [
                "AgenticToolkitLoggingWindow",
                .product(name: "AgenticToolkitCoreUI", package: "AgenticToolkitCoreUI"),
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
            ],
            path: "Tests"
        ),
    ]
)
