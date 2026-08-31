// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.mock factories are hoisted above ALL other top-level code, including plain `const`
// declarations — vi.hoisted() is the escape hatch (see ProfilePanel.test.tsx:27-32).
const { authedJson } = vi.hoisted(() => ({ authedJson: vi.fn() }));
// `readAccessToken` is the toolkit cache's tenant lookup, reached through the hook that
// presigns the preview: null is a signed-out tenant, which is all these tests need it to be.
vi.mock('@agentic-toolkit/auth/client', () => ({ authedJson, readAccessToken: () => null }));

import { EntryPhotoField } from '../EntryPhotoField';

const png = () => new File(['bytes'], 'me.png', { type: 'image/png' });

beforeEach(() => {
  authedJson.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  // Base UI's AvatarImage renders NOTHING until its own `new Image()` reports success
  // (avatar/image/useImageLoadingStatus.js) — jsdom never loads a resource, so without this
  // the <img> never mounts and this file's preview assertions can only ever fail. `complete`
  // + `naturalWidth` is that hook's own synchronous fast path, not a bypass of it.
  vi.stubGlobal(
    'Image',
    class {
      complete = true;
      naturalWidth = 1;
      src = '';
      crossOrigin: string | null = null;
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EntryPhotoField', () => {
  it('resolves the existing photo through a presigned download', async () => {
    // The id alone is unusable in an <img>: every storage route is behind jwtAuth.
    authedJson.mockResolvedValue({ url: 'https://cdn.example/p.png' });
    render(<EntryPhotoField entryId="e1" value="att_1" onChange={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('img').getAttribute('src')).toBe('https://cdn.example/p.png'),
    );
    expect(authedJson).toHaveBeenCalledWith('/api/storage/downloads/att_1');
  });

  it('refuses a file that is not an image, and calls nothing', async () => {
    const onChange = vi.fn();
    render(<EntryPhotoField entryId="e1" value={null} onChange={onChange} />);
    // `accept` is advisory — every native file dialog lets a user switch to "All files", which
    // is exactly why the runtime guard exists. user-event simulates the filter by default
    // (upload.js `applyAccept`), so reaching the guard means turning the simulation off.
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(
      screen.getByLabelText('Choose a photo'),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
    );
    expect(screen.getByText('Please choose an image file.')).not.toBeNull();
    expect(authedJson).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('initialises against the ENTRY, puts the bytes, completes, and reports the id', async () => {
    authedJson
      .mockResolvedValueOnce({ attachment: { id: 'att_new' }, uploadUrl: 'https://r2/put' })
      .mockResolvedValueOnce({});
    const onChange = vi.fn();
    const file = png();
    render(<EntryPhotoField entryId="e1" value={null} onChange={onChange} />);
    await userEvent.upload(screen.getByLabelText('Choose a photo'), file);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('att_new'));
    // The two values that make this the ENTRY's photo rather than a loose file. `ownerType`
    // is a free string server-side (storage.ts:17), so this needs no backend allowlist.
    expect(JSON.parse(String(authedJson.mock.calls[0]![1].body))).toMatchObject({
      ownerType: 'registry.entry',
      ownerId: 'e1',
      contentType: 'image/png',
      // Minor `ph-sizebytes`: the server stores this verbatim (`routes/storage.ts` —
      // `body.sizeBytes ?? 0`), so sending `0` silently under-reports every attachment's size
      // and no other assertion in this file would notice.
      sizeBytes: file.size,
    });
    // R4-I5: the METHOD on both halves, not only the URL. The presigned R2 URL is signed for
    // `PUT`, and `POST …/complete` is what moves the attachment row out of `pending` — the
    // state the public entry route filters on. Either one wrong and the photo is invisible
    // everywhere while this editor's own preview (a local object URL) still looks correct.
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('https://r2/put');
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({ method: 'PUT' });
    expect(authedJson.mock.calls[1]).toEqual([
      '/api/storage/uploads/att_new/complete',
      { method: 'POST' },
    ]);
  });

  it('clears the file input, so the same photo can be re-picked after a failure', async () => {
    // Minor `ph-input-reset`. `onFile` resets `e.target.value` before it does anything else,
    // and deleting that line left the suite green. A file input fires `change` only when its
    // value CHANGES, so without the reset the registrant's second attempt at the same file
    // after a failed upload is silently ignored — the retry the error message invites is the
    // one thing they cannot do.
    authedJson.mockRejectedValueOnce(new Error('Storage is offline.'));
    render(<EntryPhotoField entryId="e1" value={null} onChange={vi.fn()} />);
    const input = screen.getByLabelText<HTMLInputElement>('Choose a photo');
    await userEvent.upload(input, png());
    expect(await screen.findByText('Storage is offline.')).not.toBeNull();
    expect(input.value).toBe('');
  });

  it('skips the PUT when the init came back deduplicated', async () => {
    // No uploadUrl means the bytes are already stored — PUTting to nowhere would throw.
    authedJson.mockResolvedValueOnce({ attachment: { id: 'att_same' }, deduplicated: true });
    const onChange = vi.fn();
    render(<EntryPhotoField entryId="e1" value={null} onChange={onChange} />);
    await userEvent.upload(screen.getByLabelText('Choose a photo'), png());

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('att_same'));
    expect(fetch).not.toHaveBeenCalled();
    expect(authedJson).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed PUT instead of reporting an id that has no bytes', async () => {
    authedJson.mockResolvedValueOnce({ attachment: { id: 'att_x' }, uploadUrl: 'https://r2/put' });
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as unknown as Response);
    const onChange = vi.fn();
    render(<EntryPhotoField entryId="e1" value={null} onChange={onChange} />);
    await userEvent.upload(screen.getByLabelText('Choose a photo'), png());

    await waitFor(() => expect(screen.getByText('Upload failed (503).')).not.toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears the photo', async () => {
    authedJson.mockResolvedValue({ url: 'https://cdn.example/p.png' });
    const onChange = vi.fn();
    render(<EntryPhotoField entryId="e1" value="att_1" onChange={onChange} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
