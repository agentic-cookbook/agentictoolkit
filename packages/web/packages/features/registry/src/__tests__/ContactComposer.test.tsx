import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthHttpError } from '@agentic-toolkit/auth/client';
import { ContactComposer } from '../contact/ContactComposer';

const ok = (body: unknown, status = 201) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const envelope = (message: string, status: number) =>
  new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function mount(fetcher: (path: string, init?: RequestInit) => Promise<Response>) {
  render(
    <ContactComposer
      registrySlug="coaches"
      entrySlug="mike"
      displayName="Mike"
      signInHref="/auth?next=/coaches/mike"
      fetcher={fetcher}
    />,
  );
}

async function openAndSend(text: string) {
  await userEvent.click(screen.getByRole('button', { name: /message mike/i }));
  await userEvent.type(screen.getByRole('textbox'), text);
  await userEvent.click(screen.getByRole('button', { name: /^send$/i }));
}

describe('ContactComposer', () => {
  it('opens the DM and sends the message the visitor typed', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ chatId: 'c-1' }));
    mount(fetcher);
    await openAndSend('Are you taking clients?');

    expect(await screen.findByText(/message sent/i)).toBeInTheDocument();
    const [path, init] = fetcher.mock.calls[0]!;
    // `/registry/contact` is the backend mount; `/api` is the site's own rewrite prefix.
    expect(path).toBe('/api/registry/contact/coaches/mike');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ body: 'Are you taking clients?' });
  });

  it('offers sign-in on a 401 rather than an error', async () => {
    // An anonymous visitor is the COMMON case on these sites, so the 401 is a step in the
    // flow, not a failure — showing them a red error would read as "this is broken".
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    mount(fetcher);
    await openAndSend('hello');
    expect(await screen.findByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href', '/auth?next=/coaches/mike',
    );
  });

  it('offers sign-in when the fetcher THROWS a 401 instead of returning one', async () => {
    // This is the production path: the hosts pass `authedFetch`, which refreshes once and
    // then THROWS AuthHttpError(401) rather than handing back the Response. A composer that
    // only checked `res.status` would show an anonymous visitor a red error on every site.
    const fetcher = vi.fn().mockRejectedValue(new AuthHttpError(401, 'unauthorized'));
    mount(fetcher);
    await openAndSend('hello');
    expect(await screen.findByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href', '/auth?next=/coaches/mike',
    );
  });

  it('shows the server refusal verbatim when the recipient is not accepting messages', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(envelope('this person is not accepting messages', 403));
    mount(fetcher);
    await openAndSend('hello');
    expect(await screen.findByText(/not accepting messages/i)).toBeInTheDocument();
  });

  it('shows a thrown refusal verbatim too', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new AuthHttpError(403, 'this person is not accepting messages'));
    mount(fetcher);
    await openAndSend('hello');
    expect(await screen.findByText(/not accepting messages/i)).toBeInTheDocument();
  });

  it('will not send an empty message', async () => {
    const fetcher = vi.fn();
    mount(fetcher);
    await userEvent.click(screen.getByRole('button', { name: /message mike/i }));
    expect(screen.getByRole('button', { name: /^send$/i })).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
