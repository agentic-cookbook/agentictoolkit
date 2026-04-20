// swift-tools-version: 5.10
import PackageDescription

// SwiftPM wrapper exposing Core, CoreUI, AgenticAppKit, AgenticTerminalKit,
// and AgenticFileBrowser as library products. XcodeGen (project.yml) remains
// the canonical build for in-repo development and testing.
let package = Package(
    name: "AgenticToolkitPackages",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "Core", targets: ["Core"]),
        .library(name: "CoreUI", targets: ["CoreUI"]),
        .library(name: "AgenticAppKit", targets: ["AgenticAppKit"]),
        .library(name: "AgenticTerminalKit", targets: ["AgenticTerminalKit"]),
        .library(name: "AgenticFileBrowser", targets: ["AgenticFileBrowser"])
    ],
    dependencies: [
        .package(url: "https://github.com/CodeEditApp/CodeEditSourceEditor.git", from: "0.15.2"),
        .package(url: "https://github.com/CodeEditApp/CodeEditLanguages.git", exact: "0.1.20"),
        .package(url: "https://github.com/migueldeicaza/SwiftTerm", from: "1.2.0")
    ],
    targets: [
        .target(
            name: "Core",
            path: "Core",
            exclude: ["Tests"]
        ),
        .target(
            name: "CoreUI",
            dependencies: ["Core"],
            path: "CoreUI",
            exclude: ["Tests"]
        ),
        .target(
            name: "AgenticAppKit",
            dependencies: ["Core", "CoreUI"],
            path: "AgenticAppKit",
            exclude: ["Tests"]
        ),
        .target(
            name: "AgenticTerminalKit",
            dependencies: [
                "Core",
                "AgenticAppKit",
                .product(name: "SwiftTerm", package: "SwiftTerm")
            ],
            path: "AgenticTerminalKit",
            exclude: ["Tests"]
        ),
        .target(
            name: "AgenticFileBrowser",
            dependencies: [
                "Core",
                .product(name: "CodeEditSourceEditor", package: "CodeEditSourceEditor"),
                .product(name: "CodeEditLanguages", package: "CodeEditLanguages")
            ],
            path: "AgenticFileBrowser",
            exclude: ["Tests"]
        )
    ]
)
