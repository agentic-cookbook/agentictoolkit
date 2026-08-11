import { describe, expect, it } from "vitest"

import { checkbox, rdid, text } from "../descriptors"
import { fieldError, isEmptyValue, REQUIRED_MESSAGE, validateValues } from "../validation"
import { RDID_MESSAGE, RDID_RE, teamFields } from "./fixtures"

describe("isEmptyValue", () => {
  it("treats null, undefined, blank strings and empty lists as unset", () => {
    expect(isEmptyValue(null)).toBe(true)
    expect(isEmptyValue(undefined)).toBe(true)
    expect(isEmptyValue("")).toBe(true)
    expect(isEmptyValue("   ")).toBe(true)
    expect(isEmptyValue([])).toBe(true)
  })

  it("treats false and zero as entered values, not as absence", () => {
    // A checkbox the user deliberately cleared is not a missing answer; if it
    // were, every `required` boolean would be unsatisfiable when unticked.
    expect(isEmptyValue(false)).toBe(false)
    expect(isEmptyValue(0)).toBe(false)
  })
})

describe("fieldError", () => {
  it("reports a required field left blank before it reports anything else", () => {
    const field = text({
      label: "Slug",
      required: true,
      validate: () => "format is wrong",
      repair: (value) => value,
    })
    expect(fieldError(field, "  ", undefined)).toBe(REQUIRED_MESSAGE)
  })

  it("does not run a format rule against an empty optional value", () => {
    // "" is how an optional field says "unset". Running the rule on it would
    // reject the empty state and leave the pane permanently unsaveable.
    const field = rdid({ label: "Identifier", validate: () => "nope", repair: (v) => v })
    expect(fieldError(field, "", undefined)).toBeNull()
  })

  it("runs the field's own rule on a non-empty value, with the container's context", () => {
    const field = text<{ prefix: string }>({
      label: "Name",
      validate: (value, context) => (value.startsWith(context.prefix) ? null : "wrong prefix"),
      repair: (value, context) => `${context.prefix}${value}`,
    })
    expect(fieldError(field, "adh.x", { prefix: "adh." })).toBeNull()
    expect(fieldError(field, "x", { prefix: "adh." })).toBe("wrong prefix")
  })

  it("accepts any value for a field that declares no rule", () => {
    expect(fieldError(checkbox({ label: "Archived" }), true, undefined)).toBeNull()
  })
})

describe("validateValues", () => {
  it("returns nothing for a record every field accepts", () => {
    expect(
      validateValues(
        { displayName: "Participants", identifier: "adh.participants", archived: false },
        teamFields,
        { orgSlug: "adh" },
      ),
    ).toEqual({})
  })

  it("names each failing field, and only the failing ones", () => {
    const errors = validateValues(
      { displayName: "", identifier: "participants", archived: false },
      teamFields,
      { orgSlug: "adh" },
    )
    expect(errors).toEqual({
      displayName: REQUIRED_MESSAGE,
      identifier: RDID_MESSAGE,
    })
    expect(RDID_RE.test("participants")).toBe(false)
  })
})
