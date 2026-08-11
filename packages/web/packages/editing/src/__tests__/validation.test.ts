import { describe, expect, it } from "vitest"

import { checkbox, rdid, select, text } from "../descriptors"
import {
  fieldError,
  isEmptyValue,
  REQUIRED_MESSAGE,
  unlistedChoiceMessage,
  validateValues,
} from "../validation"
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

describe("a select holding a value its own options do not offer", () => {
  const visibility = select({
    label: "Visibility",
    options: [
      { value: "private", label: "Private" },
      { value: "team", label: "Team" },
    ],
  })

  it("reports the stored value instead of passing it as valid", () => {
    // A choice that was retired while rows still held it. This is the one field
    // kind whose control cannot show a value it was not given a place for, so
    // silence here would be worse than a normal validation failure: the pane
    // would state a value the row does not hold (see controls.test.tsx), and the
    // user would have no way to know their next Save overwrote something.
    expect(fieldError(visibility, "retired", undefined)).toBe(unlistedChoiceMessage("retired"))
  })

  it("says nothing about a value the options do offer", () => {
    // The control case: without it, a rule that rejected EVERY select value
    // would pass the test above.
    expect(fieldError(visibility, "team", undefined)).toBeNull()
  })

  it("matches on the option's own value, not on the DOM's string of it", () => {
    // A numeric select round-trips as a number (controls.tsx maps the string
    // back). A "2" arriving from anywhere else is a string in a numeric column,
    // which is exactly the kind of stored value worth naming.
    const retries = select({
      label: "Retries",
      options: [
        { value: 1, label: "Once" },
        { value: 2, label: "Twice" },
      ],
    })
    expect(fieldError(retries, 2, undefined)).toBeNull()
    expect(fieldError(retries, "2", undefined)).toBe(unlistedChoiceMessage("2"))
  })

  it("leaves an optional select that holds nothing alone", () => {
    // "" is how an optional select says "unset" — not a value off the list.
    expect(fieldError(visibility, "", undefined)).toBeNull()
  })

  it("still asks for a required select before complaining about the list", () => {
    const required = select({
      label: "Visibility",
      required: true,
      options: [{ value: "private", label: "Private" }],
    })
    expect(fieldError(required, "", undefined)).toBe(REQUIRED_MESSAGE)
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
