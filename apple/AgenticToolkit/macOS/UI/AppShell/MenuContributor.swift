import Foundation

/// A feature that contributes one or more menu items to the host app's
/// main menu bar and/or status-item dropdown. The host's `MenuManager`
/// asks each contributor for its `MenuContribution`s during menu install.
@MainActor
public protocol MenuContributor: AnyObject {
    func menuContributions() -> [MenuContribution]
}
