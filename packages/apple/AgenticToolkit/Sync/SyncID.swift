import Foundation

/// UUIDv7 generator — time-ordered, collision-safe ids for offline row
/// creation and push idempotency keys (spec: "client-generated UUIDv7").
public enum SyncID {
    /// RFC 9562 §6.2 Method 3 (monotonic random, counter in rand_a): a
    /// locked (lastMilliseconds, counter) pair so ids minted within the
    /// same millisecond still sort strictly after one another, instead of
    /// relying on 74 bits of independent randomness to (usually) land in
    /// the right order. Process-wide and global on purpose — the ordering
    /// guarantee is about calls to this generator, not about any one
    /// caller's call site.
    private static let lock = NSLock()
    // Safety: every read and write of these two is made exclusively from
    // inside `nextTick`, which holds `lock` for its entire body — the
    // compiler can't see that external synchronization, so it's asserted
    // explicitly rather than switching to an actor (uuidV7 must stay a
    // synchronous, non-async call for its call sites).
    private static nonisolated(unsafe) var lastMilliseconds: UInt64 = 0
    private static nonisolated(unsafe) var counter: UInt16 = 0

    /// Advances the shared (ms, counter) state for one id and returns the
    /// values to stamp into it. Same millisecond as the last call (or the
    /// clock moved backwards) → increment the 12-bit counter; on its rare
    /// overflow, borrow a virtual millisecond rather than colliding —
    /// monotonicity is the stronger guarantee here than exact wall-clock
    /// accuracy. New millisecond → reset the counter, reseeded mid-range
    /// (not 0) per RFC 9562's guidance to avoid leaking a predictable
    /// sequence start.
    private static func nextTick(wallClockMilliseconds: UInt64) -> (milliseconds: UInt64, counter: UInt16) {
        lock.lock()
        defer { lock.unlock() }
        if wallClockMilliseconds > lastMilliseconds {
            lastMilliseconds = wallClockMilliseconds
            counter = UInt16.random(in: 0...0xFFF)
        } else if counter == 0xFFF {
            lastMilliseconds += 1
            counter = 0
        } else {
            counter += 1
        }
        return (lastMilliseconds, counter)
    }

    public static func uuidV7(now: Date = Date()) -> String {
        let wallClockMilliseconds = UInt64(now.timeIntervalSince1970 * 1000)
        let (milliseconds, tickCounter) = nextTick(wallClockMilliseconds: wallClockMilliseconds)

        var bytes = [UInt8](repeating: 0, count: 16)
        bytes[0] = UInt8((milliseconds >> 40) & 0xFF)
        bytes[1] = UInt8((milliseconds >> 32) & 0xFF)
        bytes[2] = UInt8((milliseconds >> 24) & 0xFF)
        bytes[3] = UInt8((milliseconds >> 16) & 0xFF)
        bytes[4] = UInt8((milliseconds >> 8) & 0xFF)
        bytes[5] = UInt8(milliseconds & 0xFF)
        for index in 6..<16 {
            bytes[index] = UInt8.random(in: 0...255)
        }
        // rand_a (12 bits: the version nibble's low bits + all of byte 7)
        // carries the counter instead of random bits — this is what makes
        // same-millisecond ids strictly ordered.
        bytes[6] = UInt8((tickCounter >> 8) & 0x0F) | 0x70 // version 7 | counter bits 11..8
        bytes[7] = UInt8(tickCounter & 0xFF)               // counter bits 7..0
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
