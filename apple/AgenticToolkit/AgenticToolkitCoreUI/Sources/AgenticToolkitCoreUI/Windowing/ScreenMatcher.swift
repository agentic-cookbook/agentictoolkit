import AppKit

/// Finds the best matching current screen for a saved screen fingerprint.
public enum ScreenMatcher {

    public enum MatchQuality: Int, Comparable, Sendable {
        case positionOnly = 1
        case nameOnly = 2
        case uuidResChanged = 3
        case exact = 4

        public static func < (lhs: MatchQuality, rhs: MatchQuality) -> Bool {
            lhs.rawValue < rhs.rawValue
        }
    }

    public struct ScreenMatch {
        public let screen: ScreenInfo
        public let quality: MatchQuality
    }

    /// Finds the best current screen matching the saved fingerprint.
    public static func findBestMatch(
        for fingerprint: ScreenFingerprint,
        among screens: [ScreenInfo]
    ) -> ScreenMatch? {
        var candidates: [(ScreenInfo, MatchQuality)] = []

        for screen in screens {
            let current = screen.fingerprint

            // Tier 1: UUID match
            if let savedUUID = fingerprint.displayUUID,
               let currentUUID = current.displayUUID,
               savedUUID == currentUUID {
                let resMatch = abs(current.resolutionWidth - fingerprint.resolutionWidth) < 1
                    && abs(current.resolutionHeight - fingerprint.resolutionHeight) < 1
                candidates.append((screen, resMatch ? .exact : .uuidResChanged))
                continue
            }

            // Tier 2: Name match
            if let savedName = fingerprint.localizedName,
               let currentName = current.localizedName,
               savedName == currentName {
                candidates.append((screen, .nameOnly))
                continue
            }

            // Tier 3: Position match (was main, is main)
            if fingerprint.isMain && current.isMain {
                candidates.append((screen, .positionOnly))
            }
        }

        return candidates
            .max(by: { $0.1 < $1.1 })
            .map { ScreenMatch(screen: $0.0, quality: $0.1) }
    }
}
