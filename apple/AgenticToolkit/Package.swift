// swift-tools-version: 5.10
import PackageDescription

// SwiftPM wrapper exposing the toolkit as library products. XcodeGen
// (project.yml) remains the canonical build for in-repo development and
// testing.
let package = Package(
    name: "AgenticToolkitPackages",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "Core", targets: ["Core"]),
        .library(name: "Scripting", targets: ["Scripting"]),
        .library(name: "CoreUI", targets: ["CoreUI"]),
        .library(name: "AIProvider", targets: ["AIProvider"]),
        .library(name: "LoggingWindow", targets: ["LoggingWindow"]),
        .library(name: "ChatWindow", targets: ["ChatWindow"]),
        .library(name: "NotesWindow", targets: ["NotesWindow"]),
        .library(name: "SettingsWindow", targets: ["SettingsWindow"]),
        .library(name: "TerminalWindow", targets: ["TerminalWindow"]),
        .library(name: "FileBrowser", targets: ["FileBrowser"])
    ],
    dependencies: [
        .package(url: "https://github.com/CodeEditApp/CodeEditSourceEditor.git", from: "0.15.2"),
        .package(url: "https://github.com/CodeEditApp/CodeEditLanguages.git", exact: "0.1.20"),
        .package(url: "https://github.com/migueldeicaza/SwiftTerm", from: "1.2.0")
    ],
    targets: [
        .target(name: "Core", path: "Core", exclude: ["Tests"]),
        .target(name: "Scripting", dependencies: ["Core"], path: "Scripting", exclude: ["Tests"]),
        .target(name: "CoreUI", dependencies: ["Core", "Scripting"], path: "CoreUI", exclude: ["Tests"]),
        .target(name: "AIProvider", dependencies: ["Core"], path: "AIProvider", exclude: ["Tests"]),
        .target(name: "LoggingWindow", dependencies: ["Core", "CoreUI"], path: "LoggingWindow", exclude: ["Tests"]),
        .target(name: "ChatWindow", dependencies: ["Core", "CoreUI"], path: "ChatWindow"),
        .target(name: "NotesWindow", dependencies: ["Core", "CoreUI"], path: "NotesWindow"),
        .target(name: "SettingsWindow", dependencies: ["Core", "CoreUI"], path: "SettingsWindow"),
        .target(
            name: "TerminalWindow",
            dependencies: [
                "Core",
                "CoreUI",
                "AIProvider",
                .product(name: "SwiftTerm", package: "SwiftTerm")
            ],
            path: "TerminalWindow",
            exclude: ["Tests"]
        ),
        .target(
            name: "FileBrowser",
            dependencies: [
                "Core",
                .product(name: "CodeEditSourceEditor", package: "CodeEditSourceEditor"),
                .product(name: "CodeEditLanguages", package: "CodeEditLanguages")
            ],
            path: "FileBrowser",
            exclude: ["Tests"]
        )
    ]
)
