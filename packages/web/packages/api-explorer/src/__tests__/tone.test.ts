import { describe, it, expect } from "vitest"

import { methodBadgeClass, methodTextClass } from "../lib/tone"

describe("methodTextClass", () => {
  it("returns the method's text-color token for every known method", () => {
    expect(methodTextClass("GET")).toBe("text-apt-green")
    expect(methodTextClass("POST")).toBe("text-apt-blue")
    expect(methodTextClass("PUT")).toBe("text-apt-orange")
    expect(methodTextClass("PATCH")).toBe("text-apt-orange")
    expect(methodTextClass("DELETE")).toBe("text-apt-red")
  })

  it("is exactly the leading token of the method badge — one palette, cannot drift", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "TRACE"]) {
      expect(methodTextClass(method)).toBe(methodBadgeClass(method).split(" ")[0])
    }
  })

  it("falls back to the badge's neutral text token for an unknown method", () => {
    expect(methodTextClass("TRACE")).toBe("text-apt-text-muted")
  })
})
