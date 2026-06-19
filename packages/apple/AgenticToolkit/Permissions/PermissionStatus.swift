/// Tri-state grant status for a `Permission`.
///
/// `undetermined` distinguishes "can't tell yet" from a real denial — e.g. the
/// Automation target app isn't running (so `AEDeterminePermissionToAutomateTarget`
/// returns `procNotFound`/`errAEEventWouldRequireUserConsent`), or notifications
/// were never requested. Without it, a granted permission would render as "Not
/// Granted" whenever its target happens to be quit.
public enum PermissionStatus: Sendable, Equatable {
    case granted
    case denied
    case undetermined
}
