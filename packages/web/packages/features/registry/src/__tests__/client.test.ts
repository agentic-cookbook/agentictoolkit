import { describe, expect, it, vi } from 'vitest';
import { createRegistryClient } from '../client';

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('createRegistryClient', () => {
  it('sends a JSON body and the right method for a create', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ id: 'r1' }));
    const client = createRegistryClient(fetcher);
    await client.createRegistry({ slug: 'coaches', name: 'Coaches' });
    const [path, init] = fetcher.mock.calls[0]!;
    // `/registry/registries` is the backend mount; `/api` is the site's own rewrite prefix.
    expect(path).toBe('/api/registry/registries');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ slug: 'coaches', name: 'Coaches' });
  });

  it('sends no body on a GET', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ items: [] }));
    await createRegistryClient(fetcher).listRegistries();
    expect(fetcher.mock.calls[0]![1].body).toBeUndefined();
  });

  it('unwraps the backend error envelope rather than surfacing raw JSON', async () => {
    // The value validators return per-field reasons the registrant has to see, and the
    // backend wraps them in `{ error: { message } }` (app.ts:403). Surfacing the body as
    // text would show the registrant that JSON verbatim.
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'invalid values — bio: Required' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(createRegistryClient(fetcher).createEntry('r1', {})).rejects.toThrow('bio: Required');
  });

  it('falls back to the raw text when the body is not the envelope', async () => {
    // A proxy 502 never reaches app.onError, so it is plain text — still better than
    // "502 Bad Gateway" with nothing else.
    const fetcher = vi.fn().mockResolvedValue(new Response('upstream unavailable', { status: 502 }));
    await expect(createRegistryClient(fetcher).listRegistries()).rejects.toThrow(
      'upstream unavailable',
    );
  });

  it('sends no content-type header on a body-less GET', async () => {
    // A header describing a body that doesn't exist would force a CORS preflight on any
    // fetcher pointed at another origin — free to avoid.
    const fetcher = vi.fn().mockResolvedValue(ok({ items: [] }));
    await createRegistryClient(fetcher).listRegistries();
    const [, init] = fetcher.mock.calls[0]!;
    expect(init.headers).toBeUndefined();
  });

  // R6-I1: the three deletes used to call `fetcher` directly and return its raw
  // `Promise<Response>` — a non-ok response resolved SUCCESSFULLY under a bare-`fetch`
  // fetcher, so a 403/404/409/500 was invisible: the builder dropped the row, and the
  // next reload brought it back. Each now routes through the same `ok()` check `json()`
  // uses, so the rejection this test asserts is reachable from every one of the three.
  describe('delete methods reject on a non-ok response', () => {
    const conflict = () =>
      new Response(JSON.stringify({ error: { message: 'still has values' } }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });

    it('deleteSection', async () => {
      const fetcher = vi.fn().mockResolvedValue(conflict());
      await expect(createRegistryClient(fetcher).deleteSection('r1', 's1')).rejects.toThrow(
        'still has values',
      );
    });

    it('deleteFieldDef', async () => {
      const fetcher = vi.fn().mockResolvedValue(conflict());
      await expect(createRegistryClient(fetcher).deleteFieldDef('r1', 'f1')).rejects.toThrow(
        'still has values',
      );
    });

    it('deleteService', async () => {
      const fetcher = vi.fn().mockResolvedValue(conflict());
      await expect(createRegistryClient(fetcher).deleteService('r1', 'e1', 'sv1')).rejects.toThrow(
        'still has values',
      );
    });
  });

  it('resolves a successful delete with no value', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(createRegistryClient(fetcher).deleteFieldDef('r1', 'f1')).resolves.toBeUndefined();
  });

  describe('listEntries — the owner review queue', () => {
    it('sends no status filter when none is asked for', async () => {
      const fetcher = vi.fn().mockResolvedValue(ok({ items: [] }));
      await createRegistryClient(fetcher).listEntries('r1');
      expect(fetcher.mock.calls[0]![0]).toBe('/api/registry/registries/r1/entries');
    });

    it('puts the status in the query string, not the path', async () => {
      const fetcher = vi.fn().mockResolvedValue(ok({ items: [] }));
      await createRegistryClient(fetcher).listEntries('r1', 'pending');
      expect(fetcher.mock.calls[0]![0]).toBe('/api/registry/registries/r1/entries?status=pending');
    });

    it('is a GET with no body', async () => {
      const fetcher = vi.fn().mockResolvedValue(ok({ items: [] }));
      await createRegistryClient(fetcher).listEntries('r1', 'pending');
      const [, init] = fetcher.mock.calls[0]!;
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
    });

    it('surfaces the backend message on a 403 rather than resolving empty', async () => {
      // The registrant-asking-for-someone-else's-queue case. Resolving `{ items: [] }` here
      // would render an empty queue, which an owner reads as "nothing to review".
      const fetcher = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'forbidden' } }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expect(createRegistryClient(fetcher).listEntries('r1', 'pending')).rejects.toThrow('forbidden');
    });
  });

  it('percent-encodes an id/slug interpolated into the path', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ id: 'r1' }));
    await createRegistryClient(fetcher).getRegistry('a b/c');
    const [path] = fetcher.mock.calls[0]!;
    expect(path).toBe('/api/registry/registries/a%20b%2Fc');
  });
});
