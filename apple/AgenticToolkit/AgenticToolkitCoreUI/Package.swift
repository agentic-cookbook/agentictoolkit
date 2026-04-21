// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitCoreUI",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitCoreUI",
            type: .dynamic,
            targets: ["AgenticToolkitCoreUI"]
        ),
    ],
    dependencies: [
        .package(path: "../AgenticToolkitCore"),
        .package(path: "../AgenticToolkitScripting"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitCoreUI",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitScripting", package: "AgenticToolkitScripting"),
            ],
            path: "Source"
        ),
        .testTarget(
            name: "AgenticToolkitCoreUITests",
            dependencies: [
                "AgenticToolkitCoreUI",
                .product(name: "AgenticToolkitScripting", package: "AgenticToolkitScripting"),
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
            ],
            path: "Tests"
        ),
    ]
)
