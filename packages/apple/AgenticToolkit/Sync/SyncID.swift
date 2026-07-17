import Foundation

/// UUIDv7 generator — time-ordered, collision-safe ids for offline row
/// creation and push idempotency keys (spec: "client-generated UUIDv7").
public enum SyncID {
    public static func uuidV7(now: Date = Date()) -> String {
        var bytes = [UInt8](repeating: 0, count: 16)
        let milliseconds = UInt64(now.timeIntervalSince1970 * 1000)
        bytes[0] = UInt8((milliseconds >> 40) & 0xFF)
        bytes[1] = UInt8((milliseconds >> 32) & 0xFF)
        bytes[2] = UInt8((milliseconds >> 24) & 0xFF)
        bytes[3] = UInt8((milliseconds >> 16) & 0xFF)
        bytes[4] = UInt8((milliseconds >> 8) & 0xFF)
        bytes[5] = UInt8(milliseconds & 0xFF)
        for index in 6..<16 {
            bytes[index] = UInt8.random(in: 0...255)
        }
        bytes[6] = (bytes[6] & 0x0F) | 0x70 // version 7
        bytes[8] = (bytes[8] & 0x3F) | 0x80 // RFC 4122 variant

        let hexChars = Array(bytes.map { String(format: "%02x", $0) }.joined())
        let groupLengths = [8, 4, 4, 4, 12]
        var groups: [String] = []
        var cursor = 0
        for length in groupLengths {
            groups.append(String(hexChars[cursor..<(cursor + length)]))
            cursor += length
        }
        return groups.joined(separator: "-")
    }
}
