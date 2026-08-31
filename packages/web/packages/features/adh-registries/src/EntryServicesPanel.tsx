'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useResourceList } from '@agentic-toolkit/data';
import { Field, FieldGroup } from '@agenticdevelopertoolkit/ui/blocks';
import { ErrorText } from '@agenticdevelopertoolkit/ui/components/error-text';
import { Button } from '@agenticdevelopertoolkit/ui/components/button';
import { Input } from '@agenticdevelopertoolkit/ui/components/input';
import { Select } from '@agenticdevelopertoolkit/ui/components/select';
import type {
  PricingModel, RegistryClient, ServiceDeliveryMode, ServiceRow,
} from '@agentic-toolkit/registry/client';
import { registryServicesKey } from './entriesCache';

/**
 * A row whose `id` is `''` has never reached the server. `key` is this row's identity across an
 * `await` — a server id once saved, or a locally minted one before that — and is never the row's
 * array position, which can shift out from under a pending save when an earlier row is removed.
 */
type Draft = ServiceRow & { dirty: boolean; key: string };

const BLANK: Omit<ServiceRow, 'sortOrder'> = {
  id: '', title: '', description: '', pricingModel: 'hourly',
  priceMin: null, priceMax: null, currency: 'USD', unit: 'hour', deliveryMode: 'virtual',
};

// Which models name a PRICE, and so need a currency. Typed against `PricingModel` (R4 Minor,
// closed by F7) so a typo is a compile error instead of a model that silently never asks for
// one — but as an exhaustive `Record` rather than the `Set` of four this started as, because a
// Set of members answers only the models it lists and defaults the rest to `false`. A seventh
// pricing model would have been silently unpriced: its rate inputs would not render and its
// currency would not be validated or sent, with nothing to notice. Here it is a missing key, a
// compile error at the decision. Same shape and same reason as PRICING_MODEL_LABEL below.
const PRICED: Record<PricingModel, boolean> = {
  hourly: true,
  per_job: true,
  per_deliverable: true,
  subscription: true,
  free: false,
  barter: false,
};

// `Record`'s exhaustiveness means a member `PRICING_MODELS` gains later and this map does not
// is a compile error, not a silently missing <option>; a typo in a key is a compile error too.
const PRICING_MODEL_LABEL: Record<PricingModel, string> = {
  hourly: 'Per hour',
  per_job: 'Per job',
  per_deliverable: 'Per deliverable',
  subscription: 'Subscription',
  free: 'Free',
  barter: 'Trade or barter',
};
const PRICING_MODEL_ORDER = Object.keys(PRICING_MODEL_LABEL) as PricingModel[];

// Deliberately its own map, not shared with EntryReachPanel's entry-delivery map: the two
// show the same three words for two independently-validated `z.enum`s
// (`registryEntries.ts:58` and `:87`). One map would mean one type, which is exactly the fold
// the client's own docblock forbids — two four-line maps is the cheaper mistake.
const SERVICE_DELIVERY_MODE_LABEL: Record<ServiceDeliveryMode, string> = {
  virtual: 'Online',
  in_person: 'In person',
  hybrid: 'Either',
};
const SERVICE_DELIVERY_MODE_ORDER = Object.keys(SERVICE_DELIVERY_MODE_LABEL) as ServiceDeliveryMode[];

// A locally minted key for a row the server has never seen. Not `crypto.randomUUID()`: not every
// environment this suite runs under provides it.
let nextKey = 0;

export interface EntryServicesPanelProps {
  client: RegistryClient;
  registryId: string;
  entryId: string;
  /** Fires whenever "any row has unsaved edits" changes, so the rail's exit guard covers it. */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Why this row cannot be saved, or `null`. One function so the disabled button and the reason
 *  beside it can never disagree — and so a rule the server owns is stated once, here. */
function rowProblem(r: ServiceRow): string | null {
  // `serviceWrite.title` is `.min(1)`: an untitled row is a 400 waiting to happen.
  if (r.title.trim() === '') return 'A service needs a title.';
  // `.length(3)`, but only when the row is actually PRICED. `saveRow` omits `currency` from the
  // body for `free`/`barter` (the server's `serviceCreate` defaults it, `serviceUpdate` is a
  // partial), and the currency `Field` itself is unmounted for those models — checking it
  // unconditionally would block a save over a control the registrant cannot see, which is the
  // exact failure this function exists to prevent.
  if (PRICED[r.pricingModel] && r.currency.trim().length !== 3) {
    return 'A currency code is three letters — USD, EUR, GBP.';
  }
  return null;
}

export function EntryServicesPanel({
  client,
  registryId,
  entryId,
  onDirtyChange,
}: EntryServicesPanelProps) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [writeError, setWriteError] = useState<string | null>(null);

  const loadServices = useCallback(
    () => client.listServices(registryId, entryId).then((res) => res.items),
    [client, registryId, entryId],
  );
  // The server's copy, through the platform cache — so re-opening the Services topic paints the
  // rows that were there a second ago instead of "Loading your services…" and a round trip. The
  // writes below hand their results back through `setItems`, which writes THROUGH the cache, so
  // what a return trip paints is the row the server last confirmed.
  const servicesKey = registryServicesKey(registryId, entryId);
  const { items, error: loadError, setItems } = useResourceList(servicesKey, loadServices);

  // The registrant's copy: the server's rows plus a `dirty` flag and, for a row the server has
  // never seen, a locally minted key. It is SEEDED from the cache exactly once per entry and
  // never re-seeded — a revalidation landing mid-sentence must not overwrite what is being typed,
  // and a per-row save already folds the server's answer back in below.
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (seededKey !== servicesKey && (items !== null || loadError !== null)) {
    setSeededKey(servicesKey);
    // A loaded row's id is stable and unique, so it doubles as the key. On a failed read the
    // panel opens empty rather than stuck: the error is on screen, and adding a service is
    // still the thing the registrant came here to do.
    setRows((items ?? []).map((s) => ({ ...s, dirty: false, key: s.id })));
  }
  // Not `seededKey !== servicesKey` alone: the seed above can lag a switch of entry by a render,
  // and the previous entry's services must never appear under this one's heading.
  const shownRows = seededKey === servicesKey ? rows : null;

  // A failed write outranks a failed read: it answers something the registrant just did.
  const error = writeError ?? loadError;

  /**
   * Dirtiness is reported from the RENDERED rows rather than at each call site, and the cleanup
   * carries as much weight as the effect.
   *
   * `StackGroupDetail` renders only the active topic (`group-topic-detail.tsx:108`), so switching
   * rails unmounts this pane and its unsaved rows go with it. The rail prompts before that — the
   * composite exit guard covers a rail row switch, not just Back (`settings-dirty.tsx:67`) — so by
   * the time we unmount the registrant has chosen to discard. Leaving `servicesDirty` true would
   * make the editor warn forever about rows that no longer exist, and nothing would ever set it
   * back: a remount reloads clean rows and would report nothing at all.
   *
   * `onDirtyChange` must stay a STABLE reference (it is `setServicesDirty`); an inline lambda in
   * the parent would re-run this on every keystroke.
   *
   * Carried :1209 — the two effects were one, and the unmount report was its cleanup. `rows` is
   * a fresh array on every keystroke, so that cleanup ran on every keystroke too: each character
   * typed announced "clean" and then "dirty" again. `reported` collapses the run to the
   * TRANSITIONS, and the unmount report moves to an effect that has no other reason to re-run.
   */
  const reported = useRef(false);
  useEffect(() => {
    if (!rows) return;
    const dirty = rows.some((r) => r.dirty);
    if (dirty === reported.current) return;
    reported.current = dirty;
    onDirtyChange?.(dirty);
  }, [rows, onDirtyChange]);

  useEffect(
    () => () => {
      if (reported.current) onDirtyChange?.(false);
    },
    [onDirtyChange],
  );

  if (shownRows === null) return <p>Loading your services…</p>;

  const patch = (key: string, part: Partial<ServiceRow>) =>
    setRows((cur) => (cur ?? []).map((r) => (r.key === key ? { ...r, ...part, dirty: true } : r)));

  // Both `saveRow` and `removeRow` add their OWN key to `busy` on entry and remove their OWN key
  // in `finally` — never `setBusy(null)`, which would let one row's completion clear a different
  // row's flag when two saves race. Every write after the `await` targets `key`, never a captured
  // index: `removeRow` can shift every later row's position while an earlier row's save is still
  // in flight, so an index read after the await may no longer name the row that started it.
  async function saveRow(key: string) {
    // `!` for the same reason the array read below carries one: the null check that guards
    // the render cannot narrow inside a hoisted function declaration.
    const index = shownRows!.findIndex((row) => row.key === key);
    const r = shownRows![index]!;
    const body: Partial<ServiceRow> = {
      title: r.title, description: r.description, pricingModel: r.pricingModel,
      priceMin: r.priceMin, priceMax: r.priceMax,
      unit: r.unit, deliveryMode: r.deliveryMode, sortOrder: index,
      // Omitted, not sent blank, for `free`/`barter`: the server defaults `currency` on create
      // and merges a partial on update, so leaving it out is a legal "no opinion" rather than a
      // value that has to pass `.length(3)`.
      ...(PRICED[r.pricingModel] ? { currency: r.currency } : {}),
    };
    setBusy((cur) => new Set(cur).add(key));
    setWriteError(null);
    try {
      const saved = r.id
        ? await client.updateService(registryId, entryId, r.id, body)
        : await client.createService(registryId, entryId, body);
      // Into the cache as well as into the draft below, by the server's id rather than by the
      // draft's key: a create has just been given its id, and the cache has never seen the row.
      setItems((cur) => {
        const list = cur ?? [];
        return list.some((old) => old.id === saved.id)
          ? list.map((old) => (old.id === saved.id ? saved : old))
          : [...list, saved];
      });
      // The server's row wins, id included — that is what turns the next save of this row
      // into an update instead of a second identical service. The OLD key is kept: adopting
      // `saved.id` as the key would remount a just-created row and drop the user's focus.
      setRows((cur) =>
        (cur ?? []).map((old) => (old.key === key ? { ...saved, dirty: false, key: old.key } : old)),
      );
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : 'Could not save that service.');
    } finally {
      setBusy((cur) => {
        const next = new Set(cur);
        next.delete(key);
        return next;
      });
    }
  }

  async function removeRow(key: string) {
    const r = shownRows!.find((row) => row.key === key)!;
    // Confirm only for a row the server already has. An unsaved row has an `id` of
    // undefined and has cost the registrant nothing but typing — asking about it is the
    // kind of prompt people learn to dismiss without reading, which is how a confirm
    // stops protecting the one case that matters. A saved row is a real DELETE with no
    // undo anywhere in this UI, so that one asks. Same `confirm()` idiom as
    // AccessTokensSection's token revocation, which is this hub's established shape for
    // "irreversible, and the row's own name is the whole of the question".
    if (r.id && !confirm(`Remove “${r.title || 'this service'}”? This cannot be undone.`)) {
      return;
    }
    setBusy((cur) => new Set(cur).add(key));
    setWriteError(null);
    try {
      if (r.id) await client.deleteService(registryId, entryId, r.id);
      setRows((cur) => (cur ?? []).filter((old) => old.key !== key));
      // A row the server never had is not in the cache to remove, and its `id` of `''` would
      // match nothing anyway.
      if (r.id) setItems((cur) => (cur ?? []).filter((old) => old.id !== r.id));
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : 'Could not remove that service.');
    } finally {
      setBusy((cur) => {
        const next = new Set(cur);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-apt-text-muted">
        Each service saves on its own — the Save button at the top of this page saves the rest
        of your listing.
      </p>

      {shownRows.length === 0 ? <p>No services yet.</p> : null}

      {shownRows.map((r, index) => {
        const n = index + 1;
        const problem = r.dirty ? rowProblem(r) : null;
        // `busy` holds KEYS, not indices or a single panel-wide flag: an index would point at the
        // wrong row once `removeRow` shifts a later row's position, and a single value would let
        // one row's save clear another's flag when two are in flight together. This row's own
        // inputs are disabled for exactly the round trip that would otherwise let mid-flight
        // keystrokes get silently overwritten by the pre-save snapshot when it resolves — while
        // every OTHER row stays interactive.
        const rowBusy = busy.has(r.key);
        return (
          // Keyed by the row's own stable identity (a server id once saved, a locally minted one
          // before that) rather than array position: a stable key is what stops a save from
          // remounting the row and dropping focus mid-edit, AND what keeps this row's state
          // attached to the right DOM node when an earlier row's removal shifts everyone's index.
          <FieldGroup
            key={r.key}
            title={`Service ${n}`}
            trailing={
              <div className="flex items-center gap-2">
                {problem ? (
                  <span className="text-xs text-apt-text-muted" role="status">
                    {problem}
                  </span>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={rowBusy || !r.dirty || problem !== null}
                  onClick={() => void saveRow(r.key)}
                >
                  {`Save service ${n}`}
                </Button>
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="sm"
                  disabled={rowBusy}
                  onClick={() => void removeRow(r.key)}
                >
                  {`Remove service ${n}`}
                </Button>
              </div>
            }
          >
            <Field label={`Service ${n} title`}>
              <Input
                value={r.title}
                maxLength={255}
                disabled={rowBusy}
                onChange={(e) => patch(r.key, { title: e.target.value })}
              />
            </Field>

            <Field label={`Service ${n} description`}>
              <Input
                value={r.description}
                maxLength={4000}
                disabled={rowBusy}
                onChange={(e) => patch(r.key, { description: e.target.value })}
              />
            </Field>

            <Field label={`Service ${n} pricing`}>
              <Select
                value={r.pricingModel}
                disabled={rowBusy}
                onChange={(e) => patch(r.key, { pricingModel: e.target.value as PricingModel })}
              >
                {PRICING_MODEL_ORDER.map((m) => (
                  <option key={m} value={m}>{PRICING_MODEL_LABEL[m]}</option>
                ))}
              </Select>
            </Field>

            {PRICED[r.pricingModel] ? (
              <>
                <Field label={`Service ${n} from`} hint="Whole units. Leave blank to say nothing.">
                  <Input
                    inputMode="numeric"
                    value={r.priceMin === null ? '' : String(r.priceMin)}
                    disabled={rowBusy}
                    onChange={(e) => patch(r.key, { priceMin: parsePrice(e.target.value) })}
                  />
                </Field>
                <Field label={`Service ${n} to`}>
                  <Input
                    inputMode="numeric"
                    value={r.priceMax === null ? '' : String(r.priceMax)}
                    disabled={rowBusy}
                    onChange={(e) => patch(r.key, { priceMax: parsePrice(e.target.value) })}
                  />
                </Field>
                <Field label={`Service ${n} currency`}>
                  <Input
                    value={r.currency}
                    maxLength={3}
                    disabled={rowBusy}
                    onChange={(e) => patch(r.key, { currency: e.target.value.toUpperCase() })}
                  />
                </Field>
                <Field label={`Service ${n} per`} hint="hour, project, month…">
                  <Input
                    value={r.unit}
                    maxLength={32}
                    disabled={rowBusy}
                    onChange={(e) => patch(r.key, { unit: e.target.value })}
                  />
                </Field>
              </>
            ) : null}

            <Field label={`Service ${n} delivery`}>
              <Select
                value={r.deliveryMode}
                disabled={rowBusy}
                onChange={(e) => patch(r.key, { deliveryMode: e.target.value as ServiceDeliveryMode })}
              >
                {SERVICE_DELIVERY_MODE_ORDER.map((m) => (
                  <option key={m} value={m}>{SERVICE_DELIVERY_MODE_LABEL[m]}</option>
                ))}
              </Select>
            </Field>
          </FieldGroup>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setRows((cur) => {
            const list = cur ?? [];
            return [
              ...list,
              { ...BLANK, sortOrder: list.length, dirty: true, key: `new-${nextKey++}` },
            ];
          })
        }
      >
        Add a service
      </Button>

      {error ? <ErrorText error={error} /> : null}
    </div>
  );
}

/** Blank means "not stated" and must stay `null`: `0` renders as free, a different claim. */
function parsePrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
