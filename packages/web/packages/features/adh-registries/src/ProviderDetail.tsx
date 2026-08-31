'use client';

import type { ReactNode } from 'react';
import { Badge } from '@agenticdevelopertoolkit/ui/components/badge';
import { formatDate } from '@agenticdevelopertoolkit/ui/lib/timestamps';
import type { EntryLink, EntryRow } from '@agentic-toolkit/registry/client';
import { CONTACT_MODE_LABEL, DELIVERY_MODE_LABEL } from './EntryReachPanel';
import { safeHref } from './links';
import { VISIBILITY_LABEL } from './EntryPublishPanel';

/**
 * One provider's profile, read-only, for the roster's details pane.
 *
 * The roster's columns answer "who is in here?" — a name, an address, a type, a status. This
 * answers the question an owner asks about ONE of them: what they actually offer, where, in
 * what languages, and where else they can be found. Six columns cannot carry that without
 * becoming a table nobody can read, which is what the pane under them is for.
 *
 * The WORDS are imported, never restated: the registrant picked "Online" or "Hub members" from
 * a `<Select>` in their own editor, and an owner reading a different phrase for the same stored
 * token would have no way to tell whether they are looking at the same setting. That is the
 * whole reason those three maps are exported from the panels that own them.
 *
 * Empty fields are omitted rather than shown blank. A profile is mostly optional — a registrant
 * who filled in three things has a three-row pane, not a wall of dashes with three answers in
 * it.
 */

/** One label/value row. Renders nothing at all when there is no value — see the docblock. */
function DetailField({ label, children }: { label: string; children: ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-apt-text-dim">{label}</dt>
      <dd className="text-sm text-apt-text">{children}</dd>
    </div>
  );
}

export interface ProviderDetailProps {
  entry: EntryRow;
}

export function ProviderDetail({ entry }: ProviderDetailProps) {
  // `locationText` is what the registrant typed; the two codes are the structured pair beside
  // it. Shown as one line, because "Berlin" and "DE / BE" are one answer to "where?".
  const codes = [entry.countryCode, entry.regionCode].filter(Boolean).join(' · ');
  const location = [entry.locationText, codes].filter(Boolean).join(' — ');

  return (
    <div className="flex flex-col gap-4">
      {entry.summary && (
        <p className="max-w-prose text-sm whitespace-pre-line text-apt-text">{entry.summary}</p>
      )}

      {/* Two columns on anything wider than a phone, one below — the pane is a bottom half of a
          split, so it is wide and short, and a single column would push everything below the
          divider's default position. */}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label="Address">
          <span className="font-mono text-xs text-apt-text-muted">{entry.slug}</span>
        </DetailField>
        <DetailField label="Category">{entry.category}</DetailField>
        <DetailField label="Where">{location}</DetailField>
        <DetailField label="How they work">{DELIVERY_MODE_LABEL[entry.deliveryMode]}</DetailField>
        <DetailField label="Languages">{entry.languages.join(', ')}</DetailField>
        <DetailField label="Contact">{CONTACT_MODE_LABEL[entry.contactMode]}</DetailField>
        <DetailField label="Who can see it">{VISIBILITY_LABEL[entry.visibility]}</DetailField>
        <DetailField label="Signed up">{formatDate(entry.createdAt)}</DetailField>
        <DetailField label="Keywords">
          {entry.keywords.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {entry.keywords.map((keyword) => (
                <Badge key={keyword} variant="neutral">
                  {keyword}
                </Badge>
              ))}
            </span>
          ) : null}
        </DetailField>
        <DetailField label="Links">
          {entry.links.length > 0 ? (
            <span className="flex flex-col gap-0.5">
              {entry.links.map((link) => (
                <ProviderLink key={`${link.label}:${link.url}`} link={link} />
              ))}
            </span>
          ) : null}
        </DetailField>
      </dl>
    </div>
  );
}

/**
 * One link, as a link only when its address may become one — see `safeHref`.
 *
 * The untrusted case still renders, as plain text: the owner is looking at a profile somebody
 * else wrote, and silently hiding the row would leave them with no way to see what was actually
 * submitted. Showing the raw address is also the honest answer to "why is this one not
 * clickable?".
 */
function ProviderLink({ link }: { link: EntryLink }) {
  const href = safeHref(link.url);
  if (href === null) {
    return (
      <span className="truncate text-apt-text-muted" title={link.url}>
        {link.label ? `${link.label} — ${link.url}` : link.url}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="truncate text-apt-blue underline-offset-2 hover:underline"
    >
      {link.label || link.url}
    </a>
  );
}
