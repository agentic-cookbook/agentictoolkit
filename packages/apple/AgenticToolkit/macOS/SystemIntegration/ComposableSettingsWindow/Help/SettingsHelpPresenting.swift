import AppKit

/// What the settings window's chrome needs from whatever is showing help.
///
/// The split view and the help button talk to this and never to `NSDrawer`,
/// which is what keeps a deprecated API confined to `HelpDrawerController`
/// instead of spreading its warning across every file that mentions help. It
/// also leaves the door open for a host that would rather present help some
/// other way — a panel, a popover, a second window — without touching the
/// chrome that asks for it.
@MainActor
public protocol SettingsHelpPresenting: AnyObject {

    /// The help for the panel now showing; `nil` when that panel offers none.
    func setHelp(_ help: ComposableSettings.PanelHelp?)

    /// Whether help is on screen right now.
    var isHelpVisible: Bool { get }

    /// Shows or hides help, remembering the choice for the next launch.
    func toggleHelp()

    /// The help button now on screen. A presenter that attaches help to the
    /// window (the drawer) ignores it; one that hangs help off the control that
    /// asked for it (the popover) needs it, and only the chrome knows where that
    /// control ended up.
    var helpAnchorView: NSView? { get set }

    /// Called after `isHelpVisible` changes, so the chrome can restyle itself.
    /// The presenter can change on its own — the remembered preference is shared
    /// by every settings window — so the button can't just assume its own click
    /// is the only thing that moves the drawer.
    var onVisibilityChange: (() -> Void)? { get set }
}
