# @agentic-toolkit/editing

One owner of the draft, the Save button and the unsaved-changes guard, for every
editable surface on the platform.

A pane declares **what** it is editing. It never touches the mechanism — there is
no dirty flag to compute, no `canSave` to assemble, no guard to remember to
publish. Forgetting is what this package removes.

```tsx
import { EditingContainer, checkbox, rdid, section, dangerZone, text } from "@agentic-toolkit/editing"

const fields = {
  displayName: text({ label: "Display name", required: true }),
  identifier: rdid<{ orgSlug: string }>({
    label: "Identifier",
    hint: "Unique reverse-domain string.",
    validate: (value) => (RDID_RE.test(value) ? null : "Use reverse-domain form."),
    repair: (value, { orgSlug }) => `${orgSlug}.${value}`,
  }),
  archived: checkbox({ label: "Archived" }),
}

const sections = [section("Team", ["displayName", "identifier"]), dangerZone(["archived"])]

<EditingContainer
  record={team}
  fields={fields}
  sections={sections}
  context={{ orgSlug: org.slug }}
  onSave={(values) => updateTeam(team.id, values)}
/>
```

That is the whole call site. The container renders the sections, tracks the
draft, decides when Save may light up, and publishes the page's one
unsaved-changes guard.

## What the compiler rejects

| Mistake | What you get |
| --- | --- |
| a field name the record does not have | `NotAField<"displayNam">` |
| a control whose value type is not the field's (`checkbox()` on a `string`) | descriptor mismatch on that field |
| a `select` whose options are wider or narrower than the field's union | mismatch on that field, both directions |
| a field no section lays out | `__missingFields: "archived"` |
| a section naming a field that does not exist | `__unknownFields: "identifier"` |
| a `validate` with no `repair` beside it | the options object is rejected |
| a repair that needs context the container was not given | mismatch on that field |
| a bound control used outside a container | no import path produces one |

The last row is the load-bearing one, and it is structural rather than clever:
the bound controls live in `src/controls.tsx`, the barrel does not export them,
and `package.json` publishes exactly one `exports` key. There is no specifier
that reaches a control, so "a control outside a container" has no syntax.
**Do not add a wildcard to `exports`.** That is the enforcement.

`src/__tests__/type-enforcement.tsx` is the proof: twelve `@ts-expect-error`
cases and four positive ones. `pnpm lint` (`tsc --noEmit`) fails both ways — if
a mistake starts compiling, TypeScript reports the directive as unused.

## What it cannot reject

A hand-written raw `<input>`. Nothing in a type system prevents that, and this
package does not pretend otherwise — a retrofit has to remove them, and a review
has to keep them out.

Two faults are caught at **runtime** instead, rendered on the pane and
`console.error`'d, because a union of section keys cannot tell one occurrence of
a key from two: a field laid out in two sections, and a section naming a field
that is not declared.

## The repair pass

The bug this package was built for: a stored value that fails the pane's own
rule pins Save grey forever, because `canSave = dirty && valid` can never be
true when `valid` is false from mount. The user sees a dead pane and no reason.

So a container inspects the row it was handed, once, before the pane is usable.
If a field is invalid and has a `repair`, the user gets:

> **Repair required** — This data needs some repair and will be saved. `[OK]`

then, once the write lands:

> **Repair succeeded** `[OK]`

The prompt is modal and single-shot: while the repairing write is in flight the
button is disabled, so it cannot be acknowledged twice. If the write is refused,
the repaired values become the **draft** — the pane opens dirty with a working
Save and the user retries without re-deriving the fix. If a `repair` returns
another invalid value, that is a defect in the repair function: the pass stops,
says so, and discards nothing.

`validate` obliges `repair` in the type system for exactly this reason. A rule
with no way back from data that already fails it is how the pane died.

## Nesting

Containers nest. A table of rows is a container per row inside the pane's
container; each row's Save saves that row alone, and dirtiness rolls **up**.

The outermost container publishes the guard — one per page, whatever the depth —
so backing out of the table warns about the unsaved row even though the pane
never learns a row exists. A row dismissed mid-edit withdraws its report, so the
page is never left armed with nothing on screen the user could save to clear it.

A read-only container still renders the guard when it is the root: it publishes
no dirtiness of its own, but an editable row can sit inside a read-only pane and
that row's unsaved work is still the user's.

## The host

The navigation guard and the alert are **injected**, not imported at the point of
use (`EditingHostProvider`). The default host is the platform's own
`UnsavedChangesGuard` and `AlertModal`, so an app that mounts nothing still gets
the real behaviour.

A Next app should wrap once with `createEditingHost({ onNavigate })` so a
discarded edit keeps the client-side route transition instead of a full page
load.

```tsx
const router = useRouter()
const host = React.useMemo(
  () => createEditingHost({ onNavigate: (href) => router.push(href) }),
  [router],
)
return <EditingHostProvider host={host}>{children}</EditingHostProvider>
```

The indirection is what makes "does a dirty container arm the guard?" an
assertion rather than an integration hope. Given that getting this wrong loses a
user's work, it has to be provable at unit-test level.

## Controls

`text`, `textarea`, `rdid`, `checkbox`, `select`.

`rdid` is `text` that lowercases as the user types, so the shift key is not a
decision. `select` is typed by the field's union and returns the field's own
value — a numeric select gives back `3`, not `"3"`.

There is deliberately **no numeric control**. A number input's editing state is a
string (`""`, `"-"`, `"1."`) that is not yet a number, which needs a draft model
this container does not have. Adding one before that model exists would mean a
control that either rejects legal keystrokes or writes `NaN`.

## Commands

```sh
pnpm test    # vitest, 78 tests
pnpm lint    # tsc --noEmit, including the negative type tests
pnpm build   # dist/ (tsup) + declarations
```
