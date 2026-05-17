import Testing
import CoreGraphics
@testable import AgenticToolkitCore

@Suite("CGFloat.clamped(to:)")
struct CGFloatClampedTests {

    @Test("value inside range returns unchanged")
    func insideRange() {
        #expect(CGFloat(5).clamped(to: 0...10) == 5)
    }

    @Test("value below lowerBound returns lowerBound")
    func belowLower() {
        #expect(CGFloat(-3).clamped(to: 0...10) == 0)
    }

    @Test("value above upperBound returns upperBound")
    func aboveUpper() {
        #expect(CGFloat(42).clamped(to: 0...10) == 10)
    }

    @Test("value equal to lowerBound returns lowerBound")
    func equalLower() {
        #expect(CGFloat(0).clamped(to: 0...10) == 0)
    }

    @Test("value equal to upperBound returns upperBound")
    func equalUpper() {
        #expect(CGFloat(10).clamped(to: 0...10) == 10)
    }

    @Test("single-point range returns that point for any input")
    func degenerateRange() {
        #expect(CGFloat(-100).clamped(to: 5...5) == 5)
        #expect(CGFloat(100).clamped(to: 5...5) == 5)
        #expect(CGFloat(5).clamped(to: 5...5) == 5)
    }

    @Test("negative range works")
    func negativeRange() {
        #expect(CGFloat(-100).clamped(to: -10 ... -5) == -10)
        #expect(CGFloat(100).clamped(to: -10 ... -5) == -5)
        #expect(CGFloat(-7).clamped(to: -10 ... -5) == -7)
    }
}
