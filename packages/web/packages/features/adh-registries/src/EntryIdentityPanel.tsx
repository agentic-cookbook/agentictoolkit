'use client';

import { Field, FieldGroup } from '@agenticdevelopertoolkit/ui/blocks';
import { Input } from '@agenticdevelopertoolkit/ui/components/input';
import { Select } from '@agenticdevelopertoolkit/ui/components/select';
import type { EntryRow, ProviderType } from '@agentic-toolkit/registry/client';
import { EntryPhotoField } from './EntryPhotoField';
import { ENTRY_LIMITS, SLUG_MAX, normalizeSlugInput } from './slug';

export interface EntryIdentityPanelProps {
  draft: EntryRow;
  set: <K extends keyof EntryRow>(key: K, value: EntryRow[K]) => void;
  /** Always a saved entry id: `myEntry` creates the draft row before the editor mounts. */
  entryId: string;
  /** This registry's own word for a listing — "consultant", "developer", "coach". */
  entryTerm: string;
}

// `Record`'s exhaustiveness means a member `PROVIDER_TYPES` gains later and this map does not
// is a compile error, not a silently missing <option>.
const PROVIDER_TYPE_LABEL: Record<ProviderType, string> = {
  person: 'A person',
  // American spelling, matching the stored token and every other place the fleet writes this
  // word — the roster's own Type badge reads "Organization". A registrant picking "An
  // organisation" here and then seeing "Organization" on the roster has no way to know they are
  // the same choice.
  organization: 'An organization',
  persona: 'A persona',
};
const PROVIDER_TYPE_ORDER = Object.keys(PROVIDER_TYPE_LABEL) as ProviderType[];

/** The spine every registry has, whatever form its owner designed on top of it. */
export function EntryIdentityPanel({ draft, set, entryId, entryTerm }: EntryIdentityPanelProps) {
  return (
    // `title` is required — `FieldGroup` has no default — and matches this topic's own rail
    // label so the card a registrant lands on says the same thing the rail just said.
    <FieldGroup title="Your listing">
      <Field label="Photo" hint="Square images look best. Optional.">
        <EntryPhotoField
          entryId={entryId}
          value={draft.photoAttachmentId}
          onChange={(id) => set('photoAttachmentId', id)}
        />
      </Field>

      <Field label="Display name" hint={`How you appear in the ${entryTerm} directory.`}>
        <Input
          value={draft.displayName}
          maxLength={ENTRY_LIMITS.displayName}
          onChange={(e) => set('displayName', e.target.value)}
        />
      </Field>

      <Field
        label="Your address on this registry"
        hint="Lowercase letters, numbers and hyphens. Changing it breaks links people already have."
      >
        {/*
          R4-I1. This box was completely unguarded, and its column is the only one on the spine
          the server validates by REGEX rather than by length — so `Mike Fullerton`, `café` or
          `jo` 400'd the entire save, every other section's answers with it, with nothing on
          screen saying which field did it. The same normaliser the registry-creation box uses,
          so there is one statement of what a legal slug is; what it cannot fix (too short, an
          edge dash) is named by `slugProblem` through `saveBlock`, at the field.
        */}
        <Input
          value={draft.slug}
          maxLength={SLUG_MAX}
          onChange={(e) => set('slug', normalizeSlugInput(e.target.value))}
        />
      </Field>

      <Field label="One-line summary" hint="Shown under your name in search results.">
        <Input
          value={draft.summary}
          maxLength={ENTRY_LIMITS.summary}
          onChange={(e) => set('summary', e.target.value)}
        />
      </Field>

      <Field label="You are">
        <Select
          value={draft.providerType}
          onChange={(e) => set('providerType', e.target.value as ProviderType)}
        >
          {PROVIDER_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>{PROVIDER_TYPE_LABEL[t]}</option>
          ))}
        </Select>
      </Field>
    </FieldGroup>
  );
}
