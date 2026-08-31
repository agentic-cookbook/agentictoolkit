'use client';

import { Field, FieldGroup, TagSetField } from '@agenticdevelopertoolkit/ui/blocks';
import { Button } from '@agenticdevelopertoolkit/ui/components/button';
import { Input } from '@agenticdevelopertoolkit/ui/components/input';
import { Select } from '@agenticdevelopertoolkit/ui/components/select';
import type { ContactMode, EntryDeliveryMode, EntryLink, EntryRow } from '@agentic-toolkit/registry/client';
import { ENTRY_LIMITS } from './slug';

export interface EntryReachPanelProps {
  draft: EntryRow;
  set: <K extends keyof EntryRow>(key: K, value: EntryRow[K]) => void;
  /** The registry's category root. Prose only — the column stores the leaf. */
  categoryRoot: string;
}

// Deliberately its own map, not shared with EntryServicesPanel's service-delivery map: the
// two show the same three words for two independently-validated `z.enum`s
// (`registryEntries.ts:58` and `:87`). `Record`'s exhaustiveness means a member
// `ENTRY_DELIVERY_MODES` gains later and this map does not is a compile error, not a
// silently missing <option>.
//
// Exported because the owner's roster shows the SAME enum read-only (`ProviderDetail`), and a
// second phrasing of one stored token would leave the two of them unable to tell whether they
// are looking at the same setting. Sharing across surfaces of one enum is the opposite of the
// fold above, which was across two.
export const DELIVERY_MODE_LABEL: Record<EntryDeliveryMode, string> = {
  virtual: 'Online',
  in_person: 'In person',
  hybrid: 'Either',
};
const DELIVERY_MODE_ORDER = Object.keys(DELIVERY_MODE_LABEL) as EntryDeliveryMode[];

/** Also read by `ProviderDetail`, for the reason `DELIVERY_MODE_LABEL` is exported. */
export const CONTACT_MODE_LABEL: Record<ContactMode, string> = {
  dm: 'Direct messages on the hub',
  none: 'Do not show a contact button',
};
const CONTACT_MODE_ORDER = Object.keys(CONTACT_MODE_LABEL) as ContactMode[];

/** The typed spine, minus the three columns the identity topic owns. */
export function EntryReachPanel({ draft, set, categoryRoot }: EntryReachPanelProps) {
  const setLinks = (next: EntryLink[]) => set('links', next);
  const patchLink = (index: number, patch: Partial<EntryLink>) =>
    setLinks(draft.links.map((link, i) => (i === index ? { ...link, ...patch } : link)));

  return (
    // `title` is required — `FieldGroup` has no default — and matches this topic's own rail
    // label, same convention as `EntryIdentityPanel`.
    <FieldGroup title="How you are found">
      <Field
        label="Category"
        hint={
          categoryRoot
            ? `Most general first. This registry's root is “${categoryRoot}”, so “consulting” here reads as “${categoryRoot}.consulting”.`
            : 'Most general first, dotted — “consulting”, or “consulting.ios”.'
        }
      >
        <Input
          value={draft.category}
          maxLength={ENTRY_LIMITS.category}
          onChange={(e) => set('category', e.target.value)}
        />
      </Field>

      <TagSetField
        label="Keywords"
        noun="keyword"
        hint="What someone would type to find you."
        // No vocabulary to suggest from: keywords are per-registry and nothing collects them
        // yet. An empty list still leaves the chooser's create row working, and that is the
        // half that mints a label — so this is a missing convenience, not a missing control.
        options={[]}
        value={draft.keywords}
        onChange={(next) => set('keywords', next)}
      />

      <Field label="Where you are" hint="However you would say it out loud — “Seattle, WA”.">
        <Input
          value={draft.locationText}
          maxLength={ENTRY_LIMITS.locationText}
          onChange={(e) => set('locationText', e.target.value)}
        />
      </Field>

      <Field label="Country code" hint="Two letters, ISO-3166 — US, GB, DE.">
        <Input
          value={draft.countryCode}
          maxLength={ENTRY_LIMITS.countryCode}
          // Upper-cased here rather than at save: the facet filter compares the column
          // exactly, so `us` and `US` are two different countries.
          onChange={(e) => set('countryCode', e.target.value.toUpperCase())}
        />
      </Field>

      <Field label="State or region code" hint="Optional — WA, ON, NSW.">
        <Input
          value={draft.regionCode}
          maxLength={ENTRY_LIMITS.regionCode}
          onChange={(e) => set('regionCode', e.target.value.toUpperCase())}
        />
      </Field>

      <Field
        label="Area you serve"
        hint="Optional, in words — “the Pacific Northwest”, “anywhere online”."
      >
        <Input
          value={typeof draft.areaServed.text === 'string' ? draft.areaServed.text : ''}
          onChange={(e) => set('areaServed', { ...draft.areaServed, text: e.target.value })}
        />
      </Field>

      <Field label="How you work">
        <Select
          value={draft.deliveryMode}
          onChange={(e) => set('deliveryMode', e.target.value as EntryDeliveryMode)}
        >
          {DELIVERY_MODE_ORDER.map((m) => (
            <option key={m} value={m}>{DELIVERY_MODE_LABEL[m]}</option>
          ))}
        </Select>
      </Field>

      <TagSetField
        label="Languages"
        noun="language"
        hint="Languages you can work in."
        options={[]}
        value={draft.languages}
        onChange={(next) => set('languages', next)}
      />

      <Field
        label="How people reach you"
        hint="There is no email or phone box on purpose — a public page carrying either is harvested within days."
      >
        <Select
          value={draft.contactMode}
          onChange={(e) => set('contactMode', e.target.value as ContactMode)}
        >
          {CONTACT_MODE_ORDER.map((m) => (
            <option key={m} value={m}>{CONTACT_MODE_LABEL[m]}</option>
          ))}
        </Select>
      </Field>

      <fieldset>
        <legend>Links</legend>
        {draft.links.map((link, index) => (
          // The index IS the identity: a link row has no id, and its position is the order
          // the profile renders. Keying by URL would remount the row on every keystroke.
          <div key={index}>
            <Field label={`Link ${index + 1} label`}>
              <Input
                value={link.label}
                maxLength={ENTRY_LIMITS.linkLabel}
                onChange={(e) => patchLink(index, { label: e.target.value })}
              />
            </Field>
            <Field label={`Link ${index + 1} address`}>
              <Input
                value={link.url}
                inputMode="url"
                onChange={(e) => patchLink(index, { url: e.target.value })}
              />
            </Field>
            <Button
              type="button"
              variant="destructive-ghost"
              size="sm"
              onClick={() => setLinks(draft.links.filter((_, i) => i !== index))}
            >
              {`Remove link ${index + 1}`}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLinks([...draft.links, { label: '', url: '' }])}
        >
          Add a link
        </Button>
      </fieldset>
    </FieldGroup>
  );
}
