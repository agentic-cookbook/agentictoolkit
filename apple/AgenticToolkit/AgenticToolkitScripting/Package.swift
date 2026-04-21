// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitScripting",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitScripting",
            type: .dynamic,
            targets: ["AgenticToolkitScripting"]
        ),
    ],
    dependencies: [
        .package(path: "../AgenticToolkitCore"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitScripting",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
            ],
            path: "Source"
        ),
        .testTarget(
            name: "AgenticToolkitScriptingTests",
            dependencies: [
                "AgenticToolkitScripting",
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
            ],
            path: "Tests"
        ),
    ]
)
