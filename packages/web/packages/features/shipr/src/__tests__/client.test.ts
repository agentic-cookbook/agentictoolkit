import { describe, expect, it, vi } from 'vitest';

import { BASE, createShiprClient } from '../client';

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const fail = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } });

describe('createShiprClient — paths', () => {
  it('mounts under the site rewrite prefix, not the backend mount', () => {
    // `/shipr` is where app.ts mounts the router; `/api` is the fleet site's own
    // `next.config.ts` rewrite. Neither one carries the other's prefix.
    expect(BASE).toBe('/api/shipr');
  });

  it('reads the whole tree in one GET, with no body', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ groups: [], items: [] }));
    await createShiprClient(fetcher).tree();
    const [path, init] = fetcher.mock.calls[0]!;
    expect(path).toBe('/api/shipr/repos');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('appends the workspace slug when the client has one', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ groups: [], items: [] }));
    await createShiprClient(fetcher, 'acme').tree();
    expect(fetcher.mock.calls[0]![0]).toBe('/api/shipr/repos?workspace=acme');
  });

  it('omits the parameter entirely rather than sending an empty slug', async () => {
    // `workspace=` is a slug the resolver has to reject; absent means "the caller's own",
    // which is a different request.
    const fetcher = vi.fn().mockResolvedValue(ok({ groups: [], items: [] }));
    await createShiprClient(fetcher, '').tree();
    expect(fetcher.mock.calls[0]![0]).toBe('/api/shipr/repos');
  });

  it('escapes an id rather than pasting it into the path', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({}));
    await createShiprClient(fetcher).repo('a/b?c');
    expect(fetcher.mock.calls[0]![0]).toBe('/api/shipr/repos/a%2Fb%3Fc');
  });

  it('uses PATCH for a repository and PUT for a folder', async () => {
    // The two go to DIFFERENT routers: repos to the hand-written shipr routes, folders to
    // generic CRUD, which registers no PATCH at all.
    // A fresh Response per call: a body can only be read once.
    const fetcher = vi.fn().mockImplementation(async () => ok({}));
    const client = createShiprClient(fetcher);
    await client.updateRepo('r1', { groupId: 'g1' });
    await client.updateGroup('g1', { name: 'fleet' });
    expect(fetcher.mock.calls[0]![1].method).toBe('PATCH');
    expect(fetcher.mock.calls[1]![0]).toBe('/api/shipr/groups/g1');
    expect(fetcher.mock.calls[1]![1].method).toBe('PUT');
  });

  it('sends a JSON content-type only when there is a body', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({}));
    const client = createShiprClient(fetcher);
    await client.run({ operation: 'status', scopeKind: 'all' });
    const [, init] = fetcher.mock.calls[0]!;
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      operation: 'status',
      scopeKind: 'all',
    });
  });

  it('names the operation in the path for the per-repository buttons', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ runId: 'run1' }));
    await createShiprClient(fetcher).runOnRepo('r1', 'deploy', {
      environments: ['staging'],
    });
    expect(fetcher.mock.calls[0]![0]).toBe('/api/shipr/repos/r1/deploy');
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({
      environments: ['staging'],
    });
  });

  it('asks for the connections WITHOUT a workspace, even when it has one', async () => {
    // `integration_connections` is keyed on the person. Sending the slug would suggest the
    // answer differs between workspaces, and the backend would have to explain that it does
    // not.
    const fetcher = vi.fn().mockResolvedValue(ok({ connections: [] }));
    await createShiprClient(fetcher, 'acme').connections();
    expect(fetcher.mock.calls[0]![0]).toBe('/api/shipr/connections');
    expect(fetcher.mock.calls[0]![1].method).toBe('GET');
  });

  it('carries the cursor on an events page and drops an absent limit', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ events: [] }));
    await createShiprClient(fetcher).events('run1', 42);
    expect(fetcher.mock.calls[0]![0]).toBe(
      '/api/shipr/runs/run1/events?after=42',
    );
  });

  it('sends the cursor explicitly even at zero — only absent values are dropped', async () => {
    // `query` drops `undefined` and the empty string, not falsiness: `after=0` is a real
    // request for the whole log, and dropping it would leave the default to the backend.
    const fetcher = vi.fn().mockResolvedValue(ok({ events: [] }));
    await createShiprClient(fetcher).events('run1');
    expect(fetcher.mock.calls[0]![0]).toBe('/api/shipr/runs/run1/events?after=0');
  });
});

describe('createShiprClient — failures', () => {
  it('unwraps the backend envelope, because a refusal is the interesting answer', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        fail(409, JSON.stringify({ error: { message: 'tip is not verified' } })),
      );
    await expect(
      createShiprClient(fetcher).run({ operation: 'deploy', scopeKind: 'all' }),
    ).rejects.toThrow('tip is not verified');
  });

  it('falls back to the raw text when the body is not the envelope', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('502 Bad Gateway', { status: 502 }));
    await expect(createShiprClient(fetcher).tree()).rejects.toThrow(
      '502 Bad Gateway',
    );
  });

  it('throws on a refused delete rather than resolving', async () => {
    // A 204-shaped endpoint returning `fetcher`'s promise directly would RESOLVE on a 403,
    // and the folder would vanish from the tree while still existing in the database.
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        fail(403, JSON.stringify({ error: { message: 'not allowed' } })),
      );
    await expect(createShiprClient(fetcher).deleteGroup('g1')).rejects.toThrow(
      'not allowed',
    );
  });

  it('resolves a 204 delete with no body to parse', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(createShiprClient(fetcher).deleteGroup('g1')).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]![1].method).toBe('DELETE');
  });
});
