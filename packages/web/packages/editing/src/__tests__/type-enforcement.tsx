import * as React from "react"

import { EditingContainer } from "../container"
import type { EditingContainerProps } from "../container"
import { checkbox, rdid, select, text } from "../descriptors"
import type { AnyFieldDescriptor } from "../descriptors"
import { dangerZone, section } from "../sections"
import type { AnySection } from "../sections"

/**
 * THE NEGATIVE TYPE TESTS — the half of the guarantee no runtime test can reach.
 *
 * Every case below is a misuse the platform must not be able to ship, and each is
 * marked `@ts-expect-error`. That directive is itself checked: if a case stops
 * erroring, `tsc` reports the directive as unused and `pnpm lint` fails. So this
 * file fails BOTH ways — if a mistake starts compiling, and if a correct call
 * stops compiling.
 *
 * There is no `expect()` here and vitest never loads it; `pnpm lint` is the
 * assertion. It runs `tsc --noEmit` over `src`, which includes this directory.
 *
 * The cases go through `check`, which has EditingContainer's exact signature.
 * That keeps inference identical to a JSX call while giving each error one
 * predictable place to land — a JSX attribute's error can be reported on the
 * element name instead, which would make the directives fragile for reasons that
 * have nothing to do with what is being tested. The positive cases at the bottom
 * use the real element.
 */

function check<
  TRecord extends object,
  const TFields extends Record<string, AnyFieldDescriptor>,
  const TSections extends readonly AnySection[],
  TContext = undefined,
>(_props: EditingContainerProps<TRecord, TFields, TSections, TContext>): void {}

interface Team {
  displayName: string
  identifier: string
  archived: boolean
  visibility: "private" | "public"
}

interface OrgContext {
  orgSlug: string
}

const team: Team = {
  displayName: "Participants",
  identifier: "adh.participants",
  archived: false,
  visibility: "private",
}

const save = async (_values: Team): Promise<void> => {}

// ---------------------------------------------------------------------------
// 1. A field name the record does not have.
// ---------------------------------------------------------------------------

export function misspelledFieldName(): void {
  check({
    record: team,
    fields: {
      // @ts-expect-error - `displayNam` is not a field of Team
      displayNam: text({ label: "Display name" }),
    },
    sections: [section("Team", ["displayNam"])],
    onSave: save,
  })
}

// ---------------------------------------------------------------------------
// 2. A control whose value type is not the field's.
// ---------------------------------------------------------------------------

export function wrongControlForTheValueType(): void {
  check({
    record: team,
    fields: {
      // @ts-expect-error - `displayName` is a string; checkbox() edits a boolean
      displayName: checkbox({ label: "Display name" }),
    },
    sections: [section("Team", ["displayName"])],
    onSave: save,
  })
}

export function textControlOnABooleanField(): void {
  check({
    record: team,
    fields: {
      // @ts-expect-error - `archived` is a boolean; text() edits a string
      archived: text({ label: "Archived" }),
    },
    sections: [section("Team", ["archived"])],
    onSave: save,
  })
}

// ---------------------------------------------------------------------------
// 3. A closed choice that does not match the field's union.
// ---------------------------------------------------------------------------

export function selectOfferingAValueTheFieldCannotHold(): void {
  check({
    record: team,
    fields: {
      // @ts-expect-error - "unlisted" is not one of Team["visibility"]'s values
      visibility: select({
        label: "Visibility",
        options: [
          { value: "private", label: "Private" },
          { value: "public", label: "Public" },
          { value: "unlisted", label: "Unlisted" },
        ],
      }),
    },
    sections: [section("Team", ["visibility"])],
    onSave: save,
  })
}

export function selectMissingOneOfTheFieldsValues(): void {
  // Invariance both ways: a list SHORT of the field's union is equally wrong,
  // because a stored "public" would then have no option to render.
  check({
    record: team,
    fields: {
      // @ts-expect-error - the options omit "public", which the field can hold
      visibility: select({
        label: "Visibility",
        options: [{ value: "private", label: "Private" }],
      }),
    },
    sections: [section("Team", ["visibility"])],
    onSave: save,
  })
}

// ---------------------------------------------------------------------------
// 4. Layout coverage: every field is laid out, and only real fields are.
// ---------------------------------------------------------------------------

export function aFieldNoSectionLaysOut(): void {
  check({
    record: team,
    fields: {
      displayName: text({ label: "Display name" }),
      archived: checkbox({ label: "Archived" }),
    },
    // @ts-expect-error - `archived` is declared but laid out nowhere (__missingFields)
    sections: [section("Team", ["displayName"])],
    onSave: save,
  })
}

export function aSectionNamingAFieldThatDoesNotExist(): void {
  check({
    record: team,
    fields: {
      displayName: text({ label: "Display name" }),
    },
    // @ts-expect-error - "identifier" is laid out but never declared (__unknownFields)
    sections: [section("Team", ["displayName", "identifier"])],
    onSave: save,
  })
}

export function aDangerZoneThatForgetsAField(): void {
  check({
    record: team,
    fields: {
      displayName: text({ label: "Display name" }),
      archived: checkbox({ label: "Archived" }),
    },
    // @ts-expect-error - the danger zone covers `archived`, nothing covers `displayName`
    sections: [dangerZone(["archived"])],
    onSave: save,
  })
}

// ---------------------------------------------------------------------------
// 5. A rule with no way back from data that already fails it.
// ---------------------------------------------------------------------------

export function validateWithoutRepair(): void {
  check({
    record: team,
    fields: {
      // @ts-expect-error - `validate` obliges `repair`; a check with no fix is the bug
      identifier: rdid({
        label: "Identifier",
        validate: (value: string) => (value.includes(".") ? null : "needs a dot"),
      }),
    },
    sections: [section("Team", ["identifier"])],
    onSave: save,
  })
}

// ---------------------------------------------------------------------------
// 6. Context: a repair can only ask for what the container was given.
// ---------------------------------------------------------------------------

const identifierNeedingAnOrg = rdid<OrgContext>({
  label: "Identifier",
  validate: (value, context) => (value.startsWith(context.orgSlug) ? null : "wrong prefix"),
  repair: (value, context) => `${context.orgSlug}.${value}`,
})

export function contextNeededButNotSupplied(): void {
  check({
    record: team,
    fields: {
      // @ts-expect-error - this field's repair needs { orgSlug }; no context was given
      identifier: identifierNeedingAnOrg,
    },
    sections: [section("Team", ["identifier"])],
    onSave: save,
  })
}

export function contextOfTheWrongShape(): void {
  check({
    record: team,
    fields: {
      // @ts-expect-error - the repair reads `orgSlug`, which the context below lacks.
      // TContext is fixed by `context`, so the mismatch is reported here, on the
      // field that asked for what it does not carry.
      identifier: identifierNeedingAnOrg,
    },
    sections: [section("Team", ["identifier"])],
    context: { teamSlug: "participants" },
    onSave: save,
  })
}

// ---------------------------------------------------------------------------
// 7. onSave is handed the record, not something adjacent to it.
// ---------------------------------------------------------------------------

/** A field set with no fields in it. `Record<string, never>` would not do: its
 *  `keyof` is `string`, so the coverage check would report every string as an
 *  uncovered field. */
type EmptyFields = Record<never, never>

export function onSaveExpectingADifferentRecord(): void {
  // No fields, deliberately: with nothing else able to fail, the handler is the
  // only thing this case can be testing. TRecord is written out rather than
  // inferred, because inference would otherwise take the handler's word for what
  // the record is and report the mismatch against `record` instead.
  check<Team, EmptyFields, []>({
    record: team,
    fields: {},
    sections: [],
    // @ts-expect-error - this handler is for some other entity; a Team will not satisfy it
    onSave: async (_values: { noteId: string }) => {},
  })
}

// ---------------------------------------------------------------------------
// The positive cases. These must keep compiling — a guarantee that rejects
// correct code is not a guarantee, it is an outage.
// ---------------------------------------------------------------------------

const teamFields = {
  displayName: text({ label: "Display name", required: true }),
  identifier: identifierNeedingAnOrg,
  archived: checkbox({ label: "Archived" }),
  visibility: select({
    label: "Visibility",
    options: [
      { value: "private", label: "Private" },
      { value: "public", label: "Public" },
    ],
  }),
}

const teamSections = [
  section("Team", ["displayName", "identifier", "visibility"]),
  dangerZone(["archived"]),
]

export function aCorrectlyDeclaredPane(): React.ReactElement {
  return (
    <EditingContainer
      record={team}
      fields={teamFields}
      sections={teamSections}
      context={{ orgSlug: "adh" }}
      onSave={save}
    />
  )
}

export function aPaneWithNoRulesAndNoContext(): React.ReactElement {
  // A container whose fields ask for nothing needs no `context` prop at all.
  return (
    <EditingContainer
      record={{ displayName: team.displayName }}
      fields={{ displayName: text({ label: "Display name" }) }}
      sections={[section("Team", ["displayName"])]}
      onSave={async (values) => {
        const _name: string = values.displayName
      }}
    />
  )
}

export function aHandlerThatReadsPartOfTheRecord(): React.ReactElement {
  // Allowed, and worth stating: the container hands over the WHOLE record, and a
  // handler is free to declare only the part of it it uses. What it may not do is
  // ask for something the record has not got — see onSaveExpectingADifferentRecord.
  return (
    <EditingContainer
      record={team}
      fields={{ displayName: text({ label: "Display name" }) }}
      sections={[section("Team", ["displayName"])]}
      onSave={async (values: { displayName: string }) => {
        const _name: string = values.displayName
      }}
    />
  )
}

export function aPaneEditingPartOfARecord(): React.ReactElement {
  // Declaring a subset of the record's fields is fine — coverage is checked
  // against what is DECLARED, not against the record.
  return (
    <EditingContainer
      record={team}
      fields={{ archived: checkbox({ label: "Archived" }) }}
      sections={[dangerZone(["archived"])]}
      onSave={save}
    />
  )
}
