'use client';

import { Field, FieldGroup } from '@agenticdevelopertoolkit/ui/blocks';
import { Select } from '@agenticdevelopertoolkit/ui/components/select';
import type { PublishBlocker } from '@agentic-toolkit/registry/types';
import type { EntryRow, EntryStatus, EntryVisibility } from '@agentic-toolkit/registry/client';

export interface EntryPublishPanelProps {
  draft: EntryRow;
  set: <K extends keyof EntryRow>(key: K, value: EntryRow[K]) => void;
  /** From `publishBlockers` — the same function the server's publish gate calls. */
  blockers: PublishBlocker[];
}

/**
 * Every state the column can hold (`ENTRY_STATUSES`, `routes/registryEntries.ts`) and the word
 * this box offers for it — or `null`, meaning the box may not write it at all. Those are not
 * the same set: `pending` is a state the server puts a registrant in, never one they choose.
 *
 * One exhaustive `Record` rather than the `readonly EntryStatus[]` subset this was, plus the
 * `status === 'draft' ? 'Draft' : 'Published'` ternary that used to sit at the `<option>`.
 * Both encoded a per-member decision in a shape that answers for the members it names and
 * silently defaults the rest: a fourth status would have been quietly unwritable in the first
 * and quietly labelled "Published" by the second. As a `Record` it is a missing key — a
 * compile error, at the decision. Same shape and same reason as VISIBILITY_LABEL below.
 *
 * `EntryStatus`/`EntryVisibility` are imported from the client rather than declared here (R4
 * Minor, fixed in the registry client — it no longer leaves `EntryRow.status`/`.visibility`
 * as `string`), so there is exactly one copy of each union instead of two that could drift.
 * The cast at each `onChange` below still carries the narrowing across the DOM boundary
 * (`e.target.value` is a bare `string` on any native `<select>`), but it now casts to a type
 * this file imports, not one it owns.
 */
const STATUS_LABEL: Record<EntryStatus, string | null> = {
  draft: 'Draft',
  pending: null,
  published: 'Published',
};
// Same `Object.keys` cast as VISIBILITY_ORDER below, for the same reason; the filter is what
// makes this the WRITABLE subset rather than all three.
const WRITABLE_STATUSES = (Object.keys(STATUS_LABEL) as EntryStatus[])
  .filter((status) => STATUS_LABEL[status] !== null);

// Order chosen for the copy below ("Nobody yet" first, the state a fresh listing starts in),
// not the client's ENTRY_VISIBILITIES order — but each value is still checked against the
// client's union, so a typo here is the compile error R4 asked for, same as WRITABLE_STATUSES
// above. `Record`'s exhaustiveness also means a member ENTRY_VISIBILITIES gains later and this
// map does not is a compile error too, not a silently missing <option>.
//
// Exported for the owner's roster (`ProviderDetail`), which shows this same setting read-only:
// the registrant chose "Hub members" here, so that is what the owner has to read there.
export const VISIBILITY_LABEL: Record<EntryVisibility, string> = {
  private: 'Nobody yet',
  hub: 'Hub members',
  public: 'Anyone',
};
// `Object.keys` widens to `string[]`; the cast back is sound because VISIBILITY_LABEL's own
// type (Record<EntryVisibility, string>) guarantees its keys are exactly EntryVisibility's
// members — unlike a cast at a value this file did not itself constrain, which is what R4
// was about, this one is recovering a fact the Record's own type already proves.
const VISIBILITY_ORDER = Object.keys(VISIBILITY_LABEL) as EntryVisibility[];

export function EntryPublishPanel({ draft, set, blockers }: EntryPublishPanelProps) {
  // R4-C3. A registry whose `submissionPolicy` is `reviewed` answers a registrant's
  // "published" with `pending` and a 200 that says nothing. Until this branch existed the
  // Status box had no `pending` option at all, so the select fell back to rendering nothing
  // selected — the registrant's submission looked lost, and the one screen that could have
  // told them otherwise showed "Draft".
  const inReview = draft.status === 'pending';
  return (
    // `title` is required — `FieldGroup` has no default — and matches this topic's own rail
    // label so the card a registrant lands on says the same thing the rail just said.
    <FieldGroup title="Publishing">
      <section aria-labelledby="re-checklist-heading">
        <h3 id="re-checklist-heading">Before you publish</h3>
        {blockers.length === 0 ? (
          <p>Everything the owner marked required is filled in.</p>
        ) : (
          // A discrete list of what is missing, per spec §13 — never a percentage. "80%
          // complete" tells a registrant they are nearly done; it never tells them what to
          // type next.
          <ul>
            {blockers.map((blocker) => (
              <li key={blocker.key}>{blocker.label}</li>
            ))}
          </ul>
        )}
      </section>

      <Field label="Who can find your listing">
        <Select
          value={draft.visibility}
          onChange={(e) => set('visibility', e.target.value as EntryVisibility)}
        >
          {VISIBILITY_ORDER.map((v) => (
            <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
          ))}
        </Select>
      </Field>

      <Field
        label="Status"
        hint={
          inReview
            ? 'The registry owner reviews each listing before it goes live.'
            : undefined
        }
      >
        {inReview ? (
          // Read-only, not a disabled select: there is no transition out of `pending` the
          // registrant is allowed to make. Sending `draft` would withdraw the submission and
          // sending `published` is re-gated straight back to `pending`, so every option a
          // control could offer either does nothing or does something nobody asked for.
          <p role="status">In review — waiting for the registry owner.</p>
        ) : (
          <Select
            value={draft.status}
            onChange={(e) => set('status', e.target.value as EntryStatus)}
          >
            {WRITABLE_STATUSES.map((status) => (
              <option key={status} value={status}>{STATUS_LABEL[status]}</option>
            ))}
          </Select>
        )}
      </Field>
    </FieldGroup>
  );
}
