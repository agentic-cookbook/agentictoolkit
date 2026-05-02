import AppKit
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

@MainActor
final class MenuManager {

    private(set) var statusItem: NSStatusItem?
    private var menuItemTargets: [ClosureMenuItemTarget] = []

    func install(contributors: [AppFeature]) {
        let all = contributors.flatMap { $0.menuContributions }
        let bySlot = Dictionary(grouping: all, by: \.slot)

        NSApp.mainMenu = buildMainMenu(slotMap: bySlot)
        installStatusItem(slotMap: bySlot)
    }

    private func buildMainMenu(slotMap: [MenuContribution.Slot: [MenuContribution]]) -> NSMenu {
        let menu = NSMenu()
        menu.addItem(submenu(buildAppMenu(extras: slotMap[.app] ?? []), title: "Agentic Toolkit"))
        menu.addItem(submenu(buildFileMenu(extras: slotMap[.file] ?? []), title: "File"))
        menu.addItem(submenu(buildEditMenu(), title: "Edit"))
        menu.addItem(submenu(buildViewMenu(extras: slotMap[.view] ?? []), title: "View"))

        let windowMenu = buildWindowMenu(extras: slotMap[.window] ?? [])
        menu.addItem(submenu(windowMenu, title: "Window"))
        NSApp.windowsMenu = windowMenu

        let helpMenu = NSMenu(title: "Help")
        menu.addItem(submenu(helpMenu, title: "Help"))
        NSApp.helpMenu = helpMenu

        return menu
    }

    private func buildAppMenu(extras: [MenuContribution]) -> NSMenu {
        let menu = NSMenu()
        menu.addItem(stock("About Agentic Toolkit", #selector(NSApplication.orderFrontStandardAboutPanel(_:))))
        menu.addItem(.separator())
        appendContributions(extras, to: menu)
        menu.addItem(.separator())
        menu.addItem(stock("Hide Agentic Toolkit", #selector(NSApplication.hide(_:)), key: "h"))
        menu.addItem(stock("Hide Others", #selector(NSApplication.hideOtherApplications(_:)),
                           key: "h", modifiers: [.command, .option]))
        menu.addItem(stock("Show All", #selector(NSApplication.unhideAllApplications(_:))))
        menu.addItem(.separator())
        menu.addItem(stock("Quit Agentic Toolkit", #selector(NSApplication.terminate(_:)), key: "q"))
        return menu
    }

    private func buildFileMenu(extras: [MenuContribution]) -> NSMenu {
        let menu = NSMenu(title: "File")
        appendContributions(extras, to: menu)
        if !extras.isEmpty { menu.addItem(.separator()) }
        menu.addItem(stock("New", #selector(NSDocumentController.newDocument(_:)), key: "n"))
        menu.addItem(stock("New Tab", #selector(TabbedViewController.newTab(_:))))
        menu.addItem(stock("Open…", #selector(NSDocumentController.openDocument(_:)), key: "o"))
        menu.addItem(buildOpenRecentItem())
        menu.addItem(.separator())
        menu.addItem(stock("Close Window", #selector(NSWindow.performClose(_:)), key: "w"))
        menu.addItem(stock("Save", #selector(NSDocument.save(_:)), key: "s"))
        menu.addItem(stock("Save As…", #selector(NSDocument.saveAs(_:)),
                           key: "S", modifiers: [.command, .shift]))
        menu.addItem(stock("Revert to Saved", #selector(NSDocument.revertToSaved(_:))))
        return menu
    }

    private func buildOpenRecentItem() -> NSMenuItem {
        let item = NSMenuItem(title: "Open Recent", action: nil, keyEquivalent: "")
        let submenu = NSMenu(title: "Open Recent")
        submenu.addItem(NSMenuItem(title: "Clear Menu",
                                   action: #selector(NSDocumentController.clearRecentDocuments(_:)),
                                   keyEquivalent: ""))
        item.submenu = submenu
        return item
    }

    private func buildEditMenu() -> NSMenu {
        let menu = NSMenu(title: "Edit")
        menu.addItem(NSMenuItem(title: "Undo", action: Selector(("undo:")), keyEquivalent: "z"))
        menu.addItem(NSMenuItem(title: "Redo", action: Selector(("redo:")), keyEquivalent: "Z"))
        menu.addItem(.separator())
        menu.addItem(stock("Cut", #selector(NSText.cut(_:)), key: "x"))
        menu.addItem(stock("Copy", #selector(NSText.copy(_:)), key: "c"))
        menu.addItem(stock("Paste", #selector(NSText.paste(_:)), key: "v"))
        menu.addItem(stock("Select All", #selector(NSText.selectAll(_:)), key: "a"))
        return menu
    }

    private func buildViewMenu(extras: [MenuContribution]) -> NSMenu {
        let menu = NSMenu(title: "View")
        appendContributions(extras, to: menu)
        if !extras.isEmpty { menu.addItem(.separator()) }
        menu.addItem(stock("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)),
                           key: "f", modifiers: [.command, .control]))
        return menu
    }

    private func buildWindowMenu(extras: [MenuContribution]) -> NSMenu {
        let menu = NSMenu(title: "Window")
        menu.addItem(stock("Minimize", #selector(NSWindow.performMiniaturize(_:)), key: "m"))
        menu.addItem(stock("Zoom", #selector(NSWindow.performZoom(_:))))
        menu.addItem(.separator())
        appendContributions(extras, to: menu)
        menu.addItem(.separator())
        menu.addItem(stock("Bring All to Front", #selector(NSApplication.arrangeInFront(_:))))
        return menu
    }

    private func installStatusItem(slotMap: [MenuContribution.Slot: [MenuContribution]]) {
        let sections: [(Int, [MenuContribution])] = slotMap
            .compactMap { (slot, contribs) -> (Int, [MenuContribution])? in
                if case let .statusItem(section) = slot { return (section, contribs) }
                return nil
            }
            .sorted(by: { $0.0 < $1.0 })

        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = item.button {
            button.image = NSImage(
                systemSymbolName: "wrench.and.screwdriver.fill",
                accessibilityDescription: "Agentic Toolkit"
            )
            button.image?.size = NSSize(width: 18, height: 18)
            button.image?.isTemplate = true
        }

        let menu = NSMenu()
        for (index, (_, contribs)) in sections.enumerated() {
            if index > 0 { menu.addItem(.separator()) }
            appendContributions(contribs, to: menu)
        }
        menu.addItem(.separator())
        menu.addItem(stock("Quit Agentic Toolkit", #selector(NSApplication.terminate(_:)), key: "q"))

        item.menu = menu
        self.statusItem = item
    }

    private func appendContributions(_ contributions: [MenuContribution], to menu: NSMenu) {
        for contribution in contributions.sorted(by: { $0.order < $1.order }) {
            let target = ClosureMenuItemTarget(action: contribution.action, isEnabled: contribution.isEnabled)
            menuItemTargets.append(target)
            let item = NSMenuItem(
                title: contribution.title,
                action: #selector(ClosureMenuItemTarget.performMenuAction(_:)),
                keyEquivalent: contribution.key
            )
            if !contribution.key.isEmpty && contribution.modifiers != .command {
                item.keyEquivalentModifierMask = contribution.modifiers
            }
            item.target = target
            menu.addItem(item)
        }
    }

    private func stock(
        _ title: String,
        _ action: Selector,
        key: String = "",
        modifiers: NSEvent.ModifierFlags = .command
    ) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        if !key.isEmpty && modifiers != .command {
            item.keyEquivalentModifierMask = modifiers
        }
        return item
    }

    private func submenu(_ menu: NSMenu, title: String) -> NSMenuItem {
        let item = NSMenuItem()
        item.title = title
        item.submenu = menu
        return item
    }
}
