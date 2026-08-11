"use client"

import * as React from "react"

import { ButtonBar } from "@agentic-toolkit/ui/blocks/button-bar"
import { FieldGroup } from "@agentic-toolkit/ui/blocks/field-group"
import { useDirtyDraft } from "@agentic-toolkit/ui/hooks/useDirtyDraft"
import { cn } from "@agentic-toolkit/ui/lib/utils"

import { BoundField } from "./controls"
import type { AnyFieldDescriptor, FieldDescriptor } from "./descriptors"
import { useEditingHost } from "./host"
import type { EditingAlertProps } from "./host"
import { planRepairs } from "./repair"
import type { RepairPlan } from "./repair"
import { duplicatedKeys } from "./sections"
import type { AnySection, SectionsCheck } from "./sections"
import { EditingScopeProvider, useDirtyRollup } from "./scope"
import { validateValues } from "./validation"

/**
 * THE EDITING CONTAINER — one place that owns the draft, the Save button and the
 * navigation guard, for every editable surface on the platform.
 *
 * The failure it removes is not a bug in any one pane; it is that the wiring was
 * ever a pane's job. Dirtiness, validity, "can Save light up" and "warn before
 * leaving" were each computed correctly somewhere and then left to each caller to
 * publish, so a new pane was one forgotten line away from a Save button that never
 * enables or an edit that vanishes on Back — with nothing failing, nothing logged,
 * and nothing on screen. Here the container computes all four and publishes them
 * itself; a caller declares WHAT it is editing and never touches the mechanism.
 *
 * What the compiler rejects:
 *
 * - a field name the record does not have (`fields`)
 * - a control whose value type is not the field's (`checkbox()` on a `string`)
 * - a `validate` with no `repair` beside it (see `Validation`)
 * - a field that no section lays out, or a section naming a field that does not
 *   exist (`sections`, reported with the names in the error)
 * - a repair that needs context the container was not given (`context`)
 * - a bound control used anywhere but inside a container — there is no import path
 *   that produces one (see `controls.tsx`)
 *
 * What it cannot: a raw `<input>` written by hand. Nothing in a type system
 * prevents that, and this file does not pretend otherwise.
 */

/** The error surfaced when `fields` names something the record has no such key for. */
type NotAField<TKey extends PropertyKey> = {
  readonly __notAFieldOfTheRecord: `${TKey & string}`
}

/**
 * Each entry of the fields map, checked against the record. A key the record does
 * not have collapses to {@link NotAField}, which no descriptor satisfies, so the
 * assignment fails with the offending name in the message.
 */
export type FieldsFor<TRecord, TFields, TContext> = {
  [TKey in keyof TFields]: TKey extends keyof TRecord
    ? FieldDescriptor<TRecord[TKey], TContext>
    : NotAField<TKey>
}

export interface EditingContainerProps<
  TRecord extends object,
  TFields extends Record<string, AnyFieldDescriptor>,
  TSections extends readonly AnySection[],
  TContext,
> {
  /** The row as loaded. A new identity re-seeds the draft — unless it is dirty,
   *  in which case the user's edits win over a background refetch. */
  readonly record: TRecord
  /** What is editable, and how. Hoist it to module scope; it is a constant. */
  readonly fields: TFields & NoInfer<FieldsFor<TRecord, TFields, TContext>>
  /** How the fields are grouped. Must cover every field exactly once. */
  readonly sections: TSections &
    NoInfer<SectionsCheck<Extract<keyof TFields, string>, TSections>>
  /** Persist the edited record. Rejecting surfaces the reason above the buttons
   *  and leaves the draft intact, so nothing is lost to a failed write. */
  readonly onSave: (values: TRecord) => void | Promise<void>
  /** Extra work Cancel should do (close the pane, deselect the row) after the
   *  draft is thrown away. */
  readonly onCancel?: () => void
  /** Whatever this record's `validate`/`repair` functions need. */
  readonly context?: TContext
  /** Render the values without controls, Save bar or guard. */
  readonly readOnly?: boolean
  /** A rule no single field can express (two fields that must agree, a total that
   *  must balance). Returning a message blocks Save and shows it above the bar. */
  readonly validate?: (values: TRecord) => string | null
  /** Rendered after the sections — where a nested container goes (a table of rows,
   *  each row its own container). Their dirtiness rolls up to this one's guard. */
  readonly children?: React.ReactNode
  readonly className?: string
}

type RepairState<TRecord> =
  | { readonly phase: "prompt"; readonly plan: RepairPlan<TRecord> }
  | { readonly phase: "applying"; readonly plan: RepairPlan<TRecord> }
  | { readonly phase: "succeeded" }
  | { readonly phase: "failed"; readonly message: string }

export function EditingContainer<
  TRecord extends object,
  const TFields extends Record<string, AnyFieldDescriptor>,
  const TSections extends readonly AnySection[],
  TContext = undefined,
>(props: EditingContainerProps<TRecord, TFields, TSections, TContext>): React.ReactElement {
  const { record, onSave, onCancel, readOnly = false, className, children } = props
  // The props are typed for the CALLER's benefit; inside, every field is just a
  // descriptor and every value is unknown. The casts are the one place the two
  // views meet, and they widen — they never assert anything the types did not
  // already establish.
  const fields = props.fields as unknown as Record<string, AnyFieldDescriptor>
  const sections = props.sections as unknown as readonly AnySection[]
  const context = props.context as TContext
  const validateRecord = props.validate

  const host = useEditingHost()
  const { draft, set, patch, dirty, commit, reset, baseline } = useDirtyDraft<TRecord>(record)

  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [repair, setRepair] = React.useState<RepairState<TRecord> | null>(null)

  const { aggregateDirty, isRoot, scope } = useDirtyRollup(dirty && !readOnly)

  // Re-seed from a new record only while clean. A refetch that lands mid-edit must
  // not overwrite what the user has typed; once they save or cancel, the next
  // render adopts the newer row.
  const seededRef = React.useRef<TRecord>(record)
  React.useEffect(() => {
    if (record === seededRef.current || dirty) return
    seededRef.current = record
    commit(record)
  }, [record, dirty, commit])

  const errors = React.useMemo(
    () => validateValues(draft as Readonly<Record<string, unknown>>, fields, context),
    [draft, fields, context],
  )
  const formError = React.useMemo(
    () => (validateRecord ? validateRecord(draft) : null),
    [validateRecord, draft],
  )

  // `canSave` is a statement about the DRAFT alone — is there something worth
  // saving, and is it savable. Whether a write is already in flight belongs at the
  // button, and ButtonBar applies it (see useDirtyDraft's docblock).
  const canSave = dirty && Object.keys(errors).length === 0 && formError === null

  // Layout faults the TYPE cannot see: a union of section keys cannot tell one
  // occurrence of a key from two, and a field laid out twice edits one value from
  // two controls. Rendered on the pane rather than thrown, so a developer meets it
  // the moment they open the surface and a user never meets a blank page.
  const layoutFaults = React.useMemo(() => {
    const faults: string[] = []
    const duplicates = duplicatedKeys(sections)
    if (duplicates.length > 0) {
      faults.push(`These fields are laid out in more than one section: ${duplicates.join(", ")}.`)
    }
    for (const spec of sections) {
      for (const key of spec.keys) {
        if (!(key in fields)) faults.push(`Section "${spec.title}" lays out unknown field "${key}".`)
      }
    }
    return faults
  }, [sections, fields])

  React.useEffect(() => {
    for (const fault of layoutFaults) console.error(`[@agentic-toolkit/editing] ${fault}`)
  }, [layoutFaults])

  // THE REPAIR PASS. Runs once per loaded record, before the pane is usable, and
  // only for a surface that can write. Keyed on the BASELINE identity rather than
  // on `record`: the baseline is what "the row as we hold it" means after a
  // successful save, and re-inspecting an already-repaired row would re-prompt.
  const inspectedRef = React.useRef<TRecord | null>(null)
  React.useEffect(() => {
    if (readOnly) return
    if (inspectedRef.current === baseline) return
    inspectedRef.current = baseline
    const plan = planRepairs(baseline, fields, context)
    if (plan.broken.length === 0) return
    if (plan.unrepaired.length > 0) {
      const detail = plan.unrepaired.map((fault) => `${fault.key}: ${fault.message}`).join("; ")
      // A repair that produces another invalid value is a defect in the repair
      // function. Saving it would write a second bad row over the first, so the
      // pass stops here and says so — loudly, but without discarding anything.
      console.error(`[@agentic-toolkit/editing] repair() left a value still invalid — ${detail}`)
      setRepair({ phase: "failed", message: detail })
      return
    }
    setRepair({ phase: "prompt", plan })
  }, [baseline, fields, context, readOnly])

  const applyRepair = React.useCallback(async () => {
    const current = repair
    if (!current || current.phase !== "prompt") return
    setRepair({ phase: "applying", plan: current.plan })
    try {
      await onSave(current.plan.repaired)
      // Mark the repaired row inspected BEFORE adopting it, so the effect above
      // sees its own result and does not prompt a second time.
      inspectedRef.current = current.plan.repaired
      commit(current.plan.repaired)
      setRepair({ phase: "succeeded" })
    } catch (error) {
      // The write failed, so the baseline stays where it was and the repaired
      // values become the DRAFT: the pane opens dirty with a working Save, and the
      // user can retry without the fix having to be worked out again.
      patch(current.plan.repaired)
      setRepair({ phase: "failed", message: messageOf(error) })
    }
  }, [repair, onSave, commit, patch])

  const handleSave = React.useCallback(async () => {
    if (!canSave || saving) return
    const values = draft
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(values)
      commit(values)
    } catch (error) {
      setSaveError(messageOf(error))
    } finally {
      setSaving(false)
    }
  }, [canSave, saving, draft, onSave, commit])

  const handleCancel = React.useCallback(() => {
    reset()
    setSaveError(null)
    onCancel?.()
  }, [reset, onCancel])

  const alert = repairAlert(repair, applyRepair, () => setRepair(null))

  return (
    <EditingScopeProvider scope={scope}>
      <div
        data-editing-container=""
        data-editing-dirty={aggregateDirty ? "" : undefined}
        className={cn("flex flex-col gap-4", className)}
      >
        {layoutFaults.length > 0 && (
          <div role="alert" className="rounded-lg border border-apt-red p-3 font-mono text-xs text-apt-red">
            {layoutFaults.map((fault) => (
              <p key={fault}>{fault}</p>
            ))}
          </div>
        )}

        {sections.map((spec, index) => (
          <FieldGroup
            key={`${index}:${spec.title}`}
            title={
              spec.tone === "danger" ? <span className="text-apt-red">{spec.title}</span> : spec.title
            }
            className={spec.tone === "danger" ? "border-apt-red/40" : undefined}
          >
            {spec.description && (
              <p className="font-mono text-[0.7rem] text-apt-text-dim">{spec.description}</p>
            )}
            {spec.keys.map((key) => {
              const descriptor = fields[key]
              if (!descriptor) return null
              return (
                <BoundField
                  key={key}
                  name={key}
                  descriptor={descriptor}
                  value={(draft as Readonly<Record<string, unknown>>)[key]}
                  error={errors[key]}
                  locked={readOnly || saving}
                  onChange={(value) => (set as (k: string, v: unknown) => void)(key, value)}
                />
              )
            })}
          </FieldGroup>
        ))}

        {children}

        {formError && (
          <p role="alert" className="font-mono text-xs text-apt-red">
            {formError}
          </p>
        )}
        {saveError && (
          <p role="alert" className="font-mono text-xs text-apt-red">
            {saveError}
          </p>
        )}

        {!readOnly && (
          <ButtonBar
            showCreate={false}
            showDelete={false}
            actions={{
              onCancel: handleCancel,
              canCancel: dirty || onCancel !== undefined,
              onSave: () => void handleSave(),
              canSave,
              saving,
            }}
          />
        )}

        {/* One guard per page: the outermost container publishes the aggregate,
            so a dirty row inside a table warns on the way out of the table.
            Rendered even when THIS container is read-only, because an editable
            row can sit inside a read-only pane and its unsaved work is still
            the user's. A read-only container's own dirtiness is already forced
            false above, so with no editable descendant the guard is inert. */}
        {isRoot && <host.UnsavedChangesGuard when={aggregateDirty} />}

        {alert && <host.Alert {...alert} />}
      </div>
    </EditingScopeProvider>
  )
}

/** The repair flow's one-button acknowledgements, in the order the user meets them. */
function repairAlert<TRecord>(
  state: RepairState<TRecord> | null,
  onApply: () => void,
  onDismiss: () => void,
): EditingAlertProps | null {
  if (!state) return null
  switch (state.phase) {
    case "prompt":
      return {
        open: true,
        tone: "info",
        title: "Repair required",
        description: "This data needs some repair and will be saved.",
        onConfirm: onApply,
      }
    case "applying":
      return {
        open: true,
        tone: "info",
        title: "Repair required",
        description: "This data needs some repair and will be saved.",
        busy: true,
        onConfirm: () => {},
      }
    case "succeeded":
      return {
        open: true,
        tone: "success",
        title: "Repair succeeded",
        onConfirm: onDismiss,
      }
    case "failed":
      return {
        open: true,
        tone: "error",
        title: "Repair failed",
        description: state.message,
        onConfirm: onDismiss,
      }
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error."
}
