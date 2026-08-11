import { describe, expect, it } from "vitest"

import { rdid, text } from "../descriptors"
import { planRepairs } from "../repair"
import { RDID_MESSAGE, teamFields } from "./fixtures"
import type { Team } from "./fixtures"

const context = { orgSlug: "adh" }

describe("planRepairs", () => {
  it("finds nothing to do for a record every rule already accepts", () => {
    const record: Team = {
      displayName: "Participants",
      identifier: "adh.participants",
      archived: false,
    }
    const plan = planRepairs(record, teamFields, context)
    expect(plan.broken).toEqual([])
    expect(plan.changed).toBe(false)
    // Unchanged means the SAME record, so a caller can compare by identity and
    // skip the write entirely.
    expect(plan.repaired).toBe(record)
  })

  it("repairs the stored value that made Save unreachable", () => {
    const record: Team = { displayName: "Participants", identifier: "participants", archived: false }
    const plan = planRepairs(record, teamFields, context)
    expect(plan.broken).toEqual([{ key: "identifier", message: RDID_MESSAGE }])
    expect(plan.repaired).toEqual({ ...record, identifier: "adh.participants" })
    expect(plan.changed).toBe(true)
    expect(plan.unrepaired).toEqual([])
  })

  it("leaves the input untouched", () => {
    const record: Team = { displayName: "Participants", identifier: "participants", archived: false }
    planRepairs(record, teamFields, context)
    expect(record.identifier).toBe("participants")
  })

  it("reports a repair that produces another invalid value instead of accepting it", () => {
    // Saving the output of a broken repair would write a second bad row over the
    // first — the one outcome worse than leaving the original alone.
    const fields = {
      identifier: rdid<typeof context>({
        label: "Identifier",
        validate: (value) => (value.includes(".") ? null : "needs a dot"),
        repair: (value) => `${value}!`,
      }),
    }
    const plan = planRepairs({ identifier: "participants" }, fields, context)
    expect(plan.broken).toEqual([{ key: "identifier", message: "needs a dot" }])
    expect(plan.unrepaired).toEqual([{ key: "identifier", message: "needs a dot" }])
  })

  it("never repairs an empty value into an invented one", () => {
    const fields = {
      identifier: rdid<typeof context>({
        label: "Identifier",
        validate: (value) => (value.includes(".") ? null : "needs a dot"),
        repair: (value, ctx) => `${ctx.orgSlug}.${value}`,
      }),
    }
    const plan = planRepairs({ identifier: "" }, fields, context)
    expect(plan.broken).toEqual([])
    expect(plan.changed).toBe(false)
  })

  it("ignores a required field left blank — that is the user's to fill in", () => {
    const fields = { displayName: text({ label: "Display name", required: true }) }
    const plan = planRepairs({ displayName: "" }, fields, context)
    expect(plan.broken).toEqual([])
    expect(plan.changed).toBe(false)
  })

  it("repairs every broken field in one pass", () => {
    const rule = {
      validate: (value: string) => (value.startsWith("adh.") ? null : "needs the prefix"),
      repair: (value: string) => `adh.${value}`,
    }
    const fields = {
      one: rdid({ label: "One", ...rule }),
      two: rdid({ label: "Two", ...rule }),
      three: rdid({ label: "Three", ...rule }),
    }
    const plan = planRepairs({ one: "a", two: "adh.b", three: "c" }, fields, context)
    expect(plan.broken.map((fault) => fault.key)).toEqual(["one", "three"])
    expect(plan.repaired).toEqual({ one: "adh.a", two: "adh.b", three: "adh.c" })
  })
})
