import { describe, expect, it } from "vitest"

import { dangerZone, duplicatedKeys, section } from "../sections"

describe("section", () => {
  it("keeps its keys and defaults to the ordinary tone", () => {
    const spec = section("Team", ["displayName", "identifier"])
    expect(spec.title).toBe("Team")
    expect(spec.keys).toEqual(["displayName", "identifier"])
    expect(spec.tone).toBe("default")
  })

  it("carries an optional description", () => {
    expect(section("Team", ["a"], { description: "Who is on it." }).description).toBe(
      "Who is on it.",
    )
  })
})

describe("dangerZone", () => {
  it("is a section with the destructive tone and a standard title", () => {
    const spec = dangerZone(["archived"])
    expect(spec.title).toBe("Danger Zone")
    expect(spec.tone).toBe("danger")
    expect(spec.keys).toEqual(["archived"])
  })

  it("lets a surface name its own danger zone", () => {
    expect(dangerZone(["archived"], { title: "Irreversible" }).title).toBe("Irreversible")
  })
})

describe("duplicatedKeys", () => {
  it("finds nothing when every field is laid out once", () => {
    expect(duplicatedKeys([section("A", ["one", "two"]), dangerZone(["three"])])).toEqual([])
  })

  it("catches the one coverage fault the type cannot see", () => {
    // The type checks the UNION of section keys against the field names, and a
    // union cannot tell one occurrence of a key from two — but two controls
    // editing one value is a real defect, so it is caught here instead.
    expect(duplicatedKeys([section("A", ["one", "two"]), section("B", ["two"])])).toEqual(["two"])
  })

  it("reports a thrice-listed key once", () => {
    expect(
      duplicatedKeys([section("A", ["x"]), section("B", ["x"]), section("C", ["x"])]),
    ).toEqual(["x"])
  })

  it("catches a key repeated inside a single section", () => {
    expect(duplicatedKeys([section("A", ["x", "x"])])).toEqual(["x"])
  })
})
