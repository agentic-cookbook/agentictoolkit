import { FIELD_VISIBILITIES } from '@agenticdevelopertoolkit/registry-types';
import type { FieldType, FieldVisibility } from '@agenticdevelopertoolkit/registry-types';
import type { PublicEntry } from '@agenticdevelopertoolkit/registry-profile';

/**
 * Runtime tuples, not just types, so an `<option>` list can be built by mapping over the
 * same constant the type is derived from rather than hand-typing a second copy that can
 * drift from it (`git blame` on `EntryPublishPanel.tsx`'s `<Select>` options is the reason
 * this exists).
 *
 * The registry's own visibility, and (below) the field-def's, are two names for two sets —
 * the backend validates each independently (`backend/src/adh/src/routes/registries.ts:41`
 * and `:102`), and a field def has no `'unlisted'` state. Do not fold the two into one type:
 * that would silently hand the narrower one a member it does not accept.
 */
export const REGISTRY_VISIBILITIES = ['public', 'unlisted', 'private'] as const;
export type RegistryVisibility = (typeof REGISTRY_VISIBILITIES)[number];

/** `backend/src/adh/src/routes/registries.ts:42`. */
export const SUBMISSION_POLICIES = ['open', 'reviewed'] as const;
export type SubmissionPolicy = (typeof SUBMISSION_POLICIES)[number];

/**
 * RE-EXPORTED, never redeclared. The set the server enforces lives in
 * `@agenticdevelopertoolkit/registry-types` (`visibility.ts`) alongside the comparisons
 * that give it meaning — `visibilitiesWithin` builds a picker's options from the same rank
 * `isWithinVisibility` rejects a write with. A second local tuple here is how this file
 * spent the previous revision offering two members while the server accepted three: the
 * missing `'authenticated'` was not a type error anywhere, it was simply an option no
 * registrant could choose.
 */
export { FIELD_VISIBILITIES };
export type { FieldVisibility };

/** `backend/src/adh/src/routes/registryEntries.ts:65`. Same members as `RegistryVisibility`
 *  today, validated independently by a different route — kept as its own name rather than
 *  reused so the two can diverge without a silent widening on either side. */
export const ENTRY_VISIBILITIES = ['public', 'unlisted', 'private'] as const;
export type EntryVisibility = (typeof ENTRY_VISIBILITIES)[number];

/** `ENTRY_STATUSES`, `backend/src/adh/src/routes/registryEntries.ts:40`. */
export const ENTRY_STATUSES = ['draft', 'pending', 'published'] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** `backend/src/adh/src/routes/registryEntries.ts:47`. */
export const PROVIDER_TYPES = ['person', 'organization', 'persona'] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

/** `backend/src/adh/src/routes/registryEntries.ts:58`. Same members as `ServiceDeliveryMode`
 *  below (`:87`) today, validated independently by a different `z.enum` on a different table
 *  — kept as its own name rather than reused so the two can diverge without a silent widening
 *  on either side. */
export const ENTRY_DELIVERY_MODES = ['in_person', 'virtual', 'hybrid'] as const;
export type EntryDeliveryMode = (typeof ENTRY_DELIVERY_MODES)[number];

/**
 * `backend/src/adh/src/routes/registryEntries.ts:62`. How the SPINE offers to be contacted
 * — a platform DM, or nothing.
 *
 * Not a ban on published contact details: an owner-defined `email`/`phone`/`address` field
 * is an ordinary field in `values`, and whether it reaches the public plane is decided by
 * its visibility (`defaultVisibilityForType` starts those three `private`, so publishing
 * one is a choice someone made). This enum only says whether the profile's own contact
 * affordance is the hub's messaging.
 */
export const CONTACT_MODES = ['dm', 'none'] as const;
export type ContactMode = (typeof CONTACT_MODES)[number];

export interface RegistryRow {
  id: string; slug: string; name: string; purpose: string; description: string;
  categoryRoot: string; entryTerm: string; visibility: RegistryVisibility;
  submissionPolicy: SubmissionPolicy;
  servicesEnabled: boolean; boundSiteId: string | null;
}

export interface SectionRow {
  id: string; key: string; label: string; description: string; sortOrder: number;
}

export interface FieldDefRow {
  id: string; sectionId: string; key: string; type: FieldType; label: string; help: string;
  required: boolean; sortOrder: number; config: Record<string, unknown>; visibility: FieldVisibility;
  showIf: { field: string; op: string; value: unknown } | null;
}

export interface EntryLink {
  label: string;
  url: string;
}

/**
 * The whole authenticated entry: the typed SPINE first, then the owner-defined tail in
 * `values`.
 *
 * Every spine column the backend's `entryWrite` accepts is named here, because
 * `updateEntry` takes `Partial<EntryRow>` — a field missing from this interface is a
 * field no editor can ever send, and the columns behind it (`category`, `keywords`,
 * `country_code`, `geo`, …) are exactly what §10's facets, §12's JSON-LD and §11's
 * contact rule read. Spec §7 lists the same set.
 *
 * The spine carries no email or phone column — see `CONTACT_MODES` above for what it does
 * carry and why. Contact details, when a registry wants them, are owner-defined fields in
 * `values` like any other.
 */
export interface EntryRow {
  id: string; registryId: string; slug: string; displayName: string; summary: string;
  photoAttachmentId: string | null;
  providerType: ProviderType;
  category: string;
  keywords: string[];
  locationText: string; countryCode: string; regionCode: string;
  geo: { lat: number; lon: number } | null;
  areaServed: Record<string, unknown>;
  deliveryMode: EntryDeliveryMode;
  links: EntryLink[];
  contactMode: ContactMode;
  languages: string[];
  status: EntryStatus; visibility: EntryVisibility; values: Record<string, unknown>;
  /**
   * The registrant's own per-field audience, keyed by `FieldDefRow.key` — the half of the
   * visibility model the field DEFS cannot express, because a def belongs to the registry
   * owner and is shared by every entry.
   *
   * A key is absent when the field simply follows its def; the def's setting is a CEILING,
   * so a present value is never looser than it AS STORED. Read the pair as
   * `tightestVisibility(override, ceiling)` anyway — the owner can tighten the def after
   * this map is written, and nothing rewrites entries in bulk when they do.
   *
   * On a PATCH this merges like `values`: an omitted key keeps its stored setting, and
   * `null` clears the override back to the def's. Asking for a LOOSER setting than the def
   * allows is a 400 naming the field, not a silent clamp.
   */
  valueVisibility: Record<string, FieldVisibility>;
}

/**
 * What an entry WRITE may carry — `Partial<EntryRow>` in every respect but one.
 *
 * `valueVisibility` is the exception because clearing an override is expressed by sending
 * `null` for its key, and `EntryRow`'s read type has no `null` in it: a stored map only
 * ever holds real settings. Typing the write off the read type alone would leave the
 * backend's documented clear-a-key semantics unreachable from this client — not a compile
 * error anywhere, just a capability no caller could name.
 */
export type EntryWrite = Partial<Omit<EntryRow, 'valueVisibility'>> & {
  valueVisibility?: Record<string, FieldVisibility | null>;
};

/** `backend/src/adh/src/routes/registryEntries.ts:82`. */
export const PRICING_MODELS = [
  'hourly', 'per_job', 'per_deliverable', 'subscription', 'free', 'barter',
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

/** `backend/src/adh/src/routes/registryEntries.ts:87`. Same members as `EntryDeliveryMode`
 *  above today, validated independently by a different `z.enum` on a different table — kept
 *  as its own name rather than reused so the two can diverge without a silent widening on
 *  either side. */
export const SERVICE_DELIVERY_MODES = ['in_person', 'virtual', 'hybrid'] as const;
export type ServiceDeliveryMode = (typeof SERVICE_DELIVERY_MODES)[number];

export interface ServiceRow {
  id: string; title: string; description: string; pricingModel: PricingModel;
  priceMin: number | null; priceMax: number | null; currency: string; unit: string;
  deliveryMode: ServiceDeliveryMode; sortOrder: number;
}

/**
 * A `fetch`-shaped call that already carries auth. Supplied by the host site.
 *
 * A fetcher may signal failure either way, and both are handled: return a non-ok
 * `Response` (a bare `fetch`, and what the tests use) or throw (`authedFetch` from
 * `@agentic-toolkit/auth/client`, which is what the hub supplies — it throws
 * `AuthHttpError` after its one refresh-and-retry on a 401). The non-ok branch below is
 * therefore unreachable on the hub and load-bearing everywhere else; do not delete it.
 */
export type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * The backend's standard error envelope is `{ error: { message } }` (`app.ts:403`).
 * Reading the body as raw text would hand the registrant that JSON verbatim, so unwrap
 * it — the value validators return per-field reasons ("bio: Required") that are the whole
 * point of surfacing a message instead of "request failed".
 */
async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    if (typeof parsed?.error?.message === 'string') return parsed.error.message;
  } catch {
    // Not JSON (a proxy's plain-text 502, say) — the raw text is the best message there is.
  }
  return text || `${res.status} ${res.statusText}`;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as T;
}

/**
 * `json`'s void sibling, for the three DELETE endpoints that return no body. Without
 * this, a delete method that called `fetcher` directly and returned its `Promise<Response>`
 * would resolve successfully on a non-ok response (403/404/409/500) under a bare-`fetch`
 * fetcher — the one branch the `Fetcher` docblock above calls load-bearing.
 */
async function ok(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await errorMessage(res));
}

/**
 * The backend mounts the registry routers at `/registry/registries` (`app.ts`, backend
 * plan Tasks 3 and 4). The `/api` prefix in front of it is the **frontend's** — every hub
 * site rewrites `/api/:path*` to `${BACKEND_URL}/:path*` in its `next.config.ts`
 * (hub's is at `next.config.ts:40-44`). No backend mount carries `/api`.
 */
const BASE = '/api/registry/registries';

export function createRegistryClient(fetcher: Fetcher) {
  const send = async <T>(path: string, method: string, body?: unknown) =>
    json<T>(
      await fetcher(path, {
        method,
        ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      }),
    );
  const del = async (path: string) => ok(await fetcher(path, { method: 'DELETE' }));

  // Every id/slug below is server-generated or `SLUG_RE`-constrained, so encoding is a
  // belt-and-braces measure rather than a fix for a reachable bug today — but the
  // signatures are plain `string`, so nothing here enforces that constraint locally.
  const seg = encodeURIComponent;

  return {
    listRegistries: () => send<{ items: RegistryRow[] }>(BASE, 'GET'),
    getRegistry: (id: string) => send<RegistryRow>(`${BASE}/${seg(id)}`, 'GET'),
    createRegistry: (body: Partial<RegistryRow>) => send<RegistryRow>(BASE, 'POST', body),
    updateRegistry: (id: string, body: Partial<RegistryRow>) =>
      send<RegistryRow>(`${BASE}/${seg(id)}`, 'PATCH', body),

    listSections: (registryId: string) =>
      send<{ items: SectionRow[] }>(`${BASE}/${seg(registryId)}/sections`, 'GET'),
    createSection: (registryId: string, body: Partial<SectionRow>) =>
      send<SectionRow>(`${BASE}/${seg(registryId)}/sections`, 'POST', body),
    updateSection: (registryId: string, id: string, body: Partial<SectionRow>) =>
      send<SectionRow>(`${BASE}/${seg(registryId)}/sections/${seg(id)}`, 'PATCH', body),
    deleteSection: (registryId: string, id: string) =>
      del(`${BASE}/${seg(registryId)}/sections/${seg(id)}`),

    listFieldDefs: (registryId: string) =>
      send<{ items: FieldDefRow[] }>(`${BASE}/${seg(registryId)}/field-defs`, 'GET'),
    createFieldDef: (registryId: string, body: Partial<FieldDefRow>) =>
      send<FieldDefRow>(`${BASE}/${seg(registryId)}/field-defs`, 'POST', body),
    // `key`, `type` and `sectionId` are absent from the update surface on purpose: all
    // three are immutable server-side, and a type change is a 400 rather than a silent
    // no-op — so sending one turns an ordinary label edit into a failed save.
    updateFieldDef: (
      registryId: string, id: string,
      body: Partial<Omit<FieldDefRow, 'id' | 'key' | 'type' | 'sectionId'>>,
    ) => send<FieldDefRow>(`${BASE}/${seg(registryId)}/field-defs/${seg(id)}`, 'PATCH', body),
    deleteFieldDef: (registryId: string, id: string) =>
      del(`${BASE}/${seg(registryId)}/field-defs/${seg(id)}`),

    /**
     * The registry OWNER's review queue, newest first.
     *
     * Gated server-side on registry *ownership*, not readability, because it returns other
     * people's unpublished entries — a registrant with an entry in this very registry gets a
     * 403. Soft-deleted entries are excluded; omitting `status` returns every status.
     *
     * `status` is validated against the write schema's own enum rather than passed through,
     * so a typo is a 400 instead of an empty page: an empty queue reads as "no submissions",
     * which is the one wrong answer an owner would act on.
     *
     * Approval is not a route of its own — it is `updateEntry(registryId, id, { status:
     * 'published' })` sent by the owner, whose PATCH is not re-gated to `pending` the way a
     * registrant's is. A second endpoint would have been a second copy of that policy.
     */
    listEntries: (registryId: string, status?: EntryStatus) =>
      send<{ items: EntryRow[] }>(
        `${BASE}/${seg(registryId)}/entries${status === undefined ? '' : `?status=${seg(status)}`}`,
        'GET',
      ),

    /**
     * The caller's own entry, created as a draft if they have none. POST because it
     * creates one — the read-only `GET .../entries/mine` 404s instead, so it can never be
     * the call that plants a row in a registry someone merely opened. Idempotent: repeat
     * calls resolve to the same row (`uq_entries_registry_owner`), which is what makes a
     * single unconditional call at editor mount correct.
     */
    myEntry: (registryId: string) =>
      send<EntryRow>(`${BASE}/${seg(registryId)}/entries/mine`, 'POST', {}),
    createEntry: (registryId: string, body: EntryWrite) =>
      send<EntryRow>(`${BASE}/${seg(registryId)}/entries`, 'POST', body),
    updateEntry: (registryId: string, id: string, body: EntryWrite) =>
      send<EntryRow>(`${BASE}/${seg(registryId)}/entries/${seg(id)}`, 'PATCH', body),

    listServices: (registryId: string, entryId: string) =>
      send<{ items: ServiceRow[] }>(`${BASE}/${seg(registryId)}/entries/${seg(entryId)}/services`, 'GET'),
    createService: (registryId: string, entryId: string, body: Partial<ServiceRow>) =>
      send<ServiceRow>(`${BASE}/${seg(registryId)}/entries/${seg(entryId)}/services`, 'POST', body),
    updateService: (registryId: string, entryId: string, id: string, body: Partial<ServiceRow>) =>
      send<ServiceRow>(`${BASE}/${seg(registryId)}/entries/${seg(entryId)}/services/${seg(id)}`, 'PATCH', body),
    deleteService: (registryId: string, entryId: string, id: string) =>
      del(`${BASE}/${seg(registryId)}/entries/${seg(entryId)}/services/${seg(id)}`),
  };
}

export type RegistryClient = ReturnType<typeof createRegistryClient>;

/**
 * What the entry-profile endpoints answer with — the same body from both halves of the
 * public/authed pair, because both are `assembleRegistryEntryPage` with one argument
 * changed (`backend/src/adh/src/routes/public.ts`).
 *
 * `entry` is `PublicEntry`, so the difference between the two is invisible to the type
 * system on purpose: the signed-in body carries MORE fields in `entry.fields`, never
 * different ones, and a renderer written against the anonymous shape renders the wider one
 * unchanged. That is what lets a page swap one for the other after mount.
 */
export interface EntryProfilePage {
  registry: { slug: string; name: string; boundSiteId: string | null };
  entry: PublicEntry;
  jsonLd: Record<string, unknown>;
}

/**
 * The signed-in view of one public entry.
 *
 * The route is `GET /registries/:registrySlug/entries/:entrySlug` — the anonymous path
 * minus its `/public` prefix, mounted at the top level behind `jwtAuth`, exactly as
 * `/users/:slug` relates to `/public/users/:slug`. Naming that relationship in ONE place is
 * why this lives here rather than in each site's own `publicApi.ts`: it is the single fact
 * a site could get wrong in a way nothing would catch, since a wrong URL 404s and the page
 * silently keeps showing the anonymous body it already had.
 *
 * Not a method on `RegistryClient`: everything there hangs off `/api/registry/registries`
 * (the owner-and-registrant surface), and this is a public read on a different mount. It
 * takes the `Fetcher` directly for the same reason — a satellite site has no registry
 * client, only `authedFetch`.
 *
 * THROWS on any failure, including 404 and 401, rather than resolving to `null`. There is
 * exactly one caller shape — a page already rendering the anonymous entry — and for it every
 * failure has the same correct answer: keep what is on screen. A `null` return would invite
 * a caller to render an empty profile instead.
 */
export async function fetchEntryProfileAsMember(
  fetcher: Fetcher,
  registrySlug: string,
  entrySlug: string,
): Promise<EntryProfilePage> {
  const seg = encodeURIComponent;
  return json<EntryProfilePage>(
    await fetcher(`/api/registries/${seg(registrySlug)}/entries/${seg(entrySlug)}`),
  );
}
