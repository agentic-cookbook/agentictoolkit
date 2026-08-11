'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { RegistryProfile } from '@agenticdevelopertoolkit/registry-profile';
import type { PublicEntry } from '@agenticdevelopertoolkit/registry-profile';
import { fetchEntryProfileAsMember, type Fetcher } from '../client';

export interface EntryProfileViewProps {
  registrySlug: string;
  entrySlug: string;
  /**
   * The ANONYMOUS entry, as the server rendered it — the initial paint and the permanent
   * fallback. Both slugs above must be the ones this entry resolved to, not the ones the URL
   * asked for: a retired slug is redirected by the backend, and asking the signed-in twin for
   * it would 404 into the fallback forever.
   */
  entry: PublicEntry;
  /** Whether the reader is signed in. The host reads its own auth context and passes it. */
  signedIn: boolean;
  /**
   * The host's authed `fetch`. Called only while `signedIn`, and only from an effect — so a
   * host that has no auth at all can pass one that throws.
   */
  fetcher: Fetcher;
  contact?: ReactNode;
}

/**
 * One entry's profile, widened for a signed-in reader after mount.
 *
 * A field scoped to `authenticated` is absent from the anonymous body by construction — the
 * server strips it before the shape exists — so the wider view cannot be a render-time
 * decision on data the page already has. It is a second request, to the signed-in twin of the
 * endpoint that produced `entry`.
 *
 * **The anonymous body is what gets server-rendered, always**, and that is the point rather
 * than a limitation. These pages exist to be found: the crawler-facing HTML must be the public
 * one, the response the CDN may cache must be a pure function of its URL, and a reader who is
 * not signed in must never see a flash of anything wider. So the swap happens in an effect,
 * after hydration, and only for a reader the server already knows is signed in.
 *
 * **Every failure keeps the anonymous body.** A 401 from an expired session, a 404 from a slug
 * that moved between the two requests, a backend outage — all of them mean "show what is
 * already on screen", which is a correct, complete profile in every case. The one thing this
 * component must never do is render less than the server sent.
 */
export function EntryProfileView({
  registrySlug,
  entrySlug,
  entry,
  signedIn,
  fetcher,
  contact,
}: EntryProfileViewProps) {
  const [wider, setWider] = useState<PublicEntry | null>(null);

  useEffect(() => {
    // Cleared FIRST, on every dependency change. Client-side navigation between two entries
    // reuses this component instance, so a `wider` left over from the previous entry would be
    // rendered against the new one — someone else's profile, under this one's URL. Setting
    // `null` when it is already `null` is a bail-out in React, so the common mount pays
    // nothing for it.
    setWider(null);
    if (!signedIn) return;
    // Not an AbortController: this response is cheap and the only thing a late one could do is
    // overwrite a newer entry's body, which the flag already prevents. An abort would also
    // reject the promise and land in the `catch` below, where it is indistinguishable from a
    // real failure.
    let live = true;
    fetchEntryProfileAsMember(fetcher, registrySlug, entrySlug)
      .then((page) => {
        if (live) setWider(page.entry);
      })
      .catch((err: unknown) => {
        // Warned, not swallowed silently: the visible outcome of this failing is a profile
        // that looks complete and is quietly missing the fields the registrant published to
        // members — nothing on screen says so, so the console is the only tell there is.
        console.warn('[EntryProfileView] signed-in view unavailable:', err);
      });
    return () => {
      live = false;
    };
  }, [signedIn, registrySlug, entrySlug, fetcher]);

  return <RegistryProfile entry={wider ?? entry} contact={contact} />;
}
