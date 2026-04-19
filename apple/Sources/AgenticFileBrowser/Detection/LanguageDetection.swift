import CodeEditLanguages
import Foundation

public enum LanguageDetection {
    /// Detects the CodeLanguage for a given file URL based on its extension.
    ///
    /// Consults user-defined custom file type mappings first. If a custom
    /// mapping exists for the file's extension, attempts to find a matching
    /// CodeLanguage by name. Falls back to the built-in CodeEditLanguages
    /// detection, and ultimately to `.default` (plain text).
    public static func language(for url: URL) -> CodeLanguage {
        let ext = url.pathExtension.lowercased()

        // Check custom mappings first
        if !ext.isEmpty, let custom = CustomFileTypeMappings.mapping(for: ext) {
            // Try to find a matching CodeLanguage by the custom language name
            let customName = custom.languageName.lowercased()
            if let match = CodeLanguage.allLanguages.first(where: {
                $0.tsName.lowercased() == customName
                || $0.extensions.contains(where: { $0.lowercased() == customName })
            }) {
                return match
            }
        }

        return CodeLanguage.detectLanguageFrom(url: url)
    }
}
